-- 10_add_no_deal_to_service_files.sql
-- Adaugă coloana no_deal pe service_files pentru a marca fișele fără deal

alter table service_files
  add column if not exists no_deal boolean not null default false;

comment on column service_files.no_deal is 'Marchează fișa ca No Deal în pipeline-ul Vânzări';

