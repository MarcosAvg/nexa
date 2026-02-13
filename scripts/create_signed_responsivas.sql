-- Create table for signed responsivas
CREATE TABLE signed_responsivas (
    id uuid default gen_random_uuid() primary key,
    person_id uuid references personnel(id) on delete cascade,
    folio text not null,
    card_type text not null,
    data jsonb not null, -- Stores the template state (name, employee no, dependency, date)
    signature text not null, -- Base64 encoded image of the signature
    created_at timestamp with time zone default now()
);

-- Enable RLS
alter table signed_responsivas enable row level security;
create policy "Enable full access for all" on signed_responsivas for all using (true) with check (true);
