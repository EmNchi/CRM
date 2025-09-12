// app/api/stages/route.ts
import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase/server"

const toSlug = (s: string) => s.toLowerCase().replace(/\s+/g, "-")

export async function POST(req: Request) {
  const supabase = supabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { pipelineSlug, name } = await req.json()
  if (!pipelineSlug || !name?.trim()) {
    return NextResponse.json({ error: "Missing pipelineSlug or name" }, { status: 400 })
  }

  // Find pipeline by slugified name
  const { data: pipes, error: pErr } = await supabase
    .from("pipelines")
    .select("id, name, created_by")

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  const pipeline = (pipes || []).find(p => toSlug(p.name) === pipelineSlug)
  if (!pipeline) {
    return NextResponse.json({ error: "Pipeline not found" }, { status: 404 })
  }

  // Owner-only guard (adjust if you also allow admins)
  const isOwner = pipeline.created_by === user.id
  if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Next position in this pipeline
  const { data: lastStage } = await supabase
    .from("stages")
    .select("position")
    .eq("pipeline_id", pipeline.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = (lastStage?.position ?? -1) + 1

  const { data: inserted, error: iErr } = await supabase
    .from("stages")
    .insert({
      name: name.trim(),
      pipeline_id: pipeline.id,
      position,
    })
    .select()
    .single()

  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 })
  return NextResponse.json({ stage: inserted })
}

export async function DELETE(req: Request) {
  const supabase = supabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { pipelineSlug, stageName } = await req.json()
  if (!pipelineSlug || !stageName) {
    return NextResponse.json({ error: "Missing pipelineSlug or stageName" }, { status: 400 })
  }

  // 1) Resolve pipeline by slugified name
  const { data: pipes, error: pErr } = await supabase
    .from("pipelines")
    .select("id, name, created_by")
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  const pipeline = (pipes || []).find(p => toSlug(p.name) === pipelineSlug)
  if (!pipeline) return NextResponse.json({ error: "Pipeline not found" }, { status: 404 })

  // Owner-only
  const isOwner = pipeline.created_by === user.id
  if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // 2) Find the stage in this pipeline
  const { data: stage, error: sErr } = await supabase
    .from("stages")
    .select("id, name, position")
    .eq("pipeline_id", pipeline.id)
    .eq("name", stageName)
    .single()
  if (sErr || !stage) return NextResponse.json({ error: "Stage not found" }, { status: 404 })

  // 3) Leads currently in this stage (for this pipeline)
  const { data: lpRows, error: lpErr } = await supabase
    .from("lead_pipelines")
    .select("id, lead_id")
    .eq("pipeline_id", pipeline.id)
    .eq("stage_id", stage.id)
  if (lpErr) return NextResponse.json({ error: lpErr.message }, { status: 500 })

  const leadIds = (lpRows || []).map(r => r.lead_id)

  // 4) Delete stage history for those leads but ONLY within this pipeline
  if (leadIds.length > 0) {
    const { error: shDelErr } = await supabase
      .from("stage_history")
      .delete()
      .eq("pipeline_id", pipeline.id)
      .in("lead_id", leadIds)
    if (shDelErr) return NextResponse.json({ error: shDelErr.message }, { status: 500 })
  }

  // 5) Delete lead assignments for this stage in this pipeline
  if (lpRows?.length) {
    const lpIds = lpRows.map(r => r.id)
    const { error: lpDelErr } = await supabase
      .from("lead_pipelines")
      .delete()
      .in("id", lpIds)
    if (lpDelErr) return NextResponse.json({ error: lpDelErr.message }, { status: 500 })
  }

  // 6) Delete orphan leads (those from above that now have zero assignments anywhere)
  if (leadIds.length > 0) {
    const { data: stillAssigned, error: stillErr } = await supabase
      .from("lead_pipelines")
      .select("lead_id")
      .in("lead_id", leadIds)

    if (stillErr) return NextResponse.json({ error: stillErr.message }, { status: 500 })

    const stillSet = new Set((stillAssigned || []).map(r => r.lead_id))
    const orphanIds = leadIds.filter(id => !stillSet.has(id))

    if (orphanIds.length > 0) {
      const { error: leadsDelErr } = await supabase
        .from("leads")
        .delete()
        .in("id", orphanIds)
      if (leadsDelErr) return NextResponse.json({ error: leadsDelErr.message }, { status: 500 })
    }
  }

  // 7) Delete the stage
  const { error: stageDelErr } = await supabase
    .from("stages")
    .delete()
    .eq("id", stage.id)
  if (stageDelErr) return NextResponse.json({ error: stageDelErr.message }, { status: 500 })

  // 8) Compact positions (0..n-1) for remaining stages in this pipeline
  const { data: stagesLeft, error: stLeftErr } = await supabase
    .from("stages")
    .select("id")
    .eq("pipeline_id", pipeline.id)
    .order("position", { ascending: true })

  if (!stLeftErr && stagesLeft) {
    // reindex sequentially
    for (let i = 0; i < stagesLeft.length; i++) {
      const st = stagesLeft[i]
      // Note: PostgREST can't do "position = position - 1" expressions directly; update each.
      await supabase.from("stages").update({ position: i }).eq("id", st.id)
    }
  }

  return NextResponse.json({ ok: true })
}
