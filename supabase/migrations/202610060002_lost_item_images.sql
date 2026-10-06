-- Optional lost-item photos for the private relay flow.
begin;

alter table public.lost_item_requests
  add column if not exists image_url text
    check (image_url is null or char_length(image_url) <= 1200);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lost-item-images',
  'lost-item-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users upload their own lost-item images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'lost-item-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users delete their own lost-item images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'lost-item-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

commit;
