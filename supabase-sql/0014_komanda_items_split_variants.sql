-- 0014_komanda_items_split_variants.sql
-- Split-taco support: a single komanda_item may combine two variants
-- (mitad-y-mitad). Same price as a regular item — second variant is a
-- label-only override of the first. variant_id_2 is null for non-split
-- items.

alter table public.komanda_items
  add column if not exists variant_id_2            uuid references public.variants(id),
  add column if not exists variant_2_name_snapshot text;

-- Guard: a split item must have both a primary variant and a different
-- secondary variant. Snapshots must accompany the FKs (or both be null).
alter table public.komanda_items
  drop constraint if exists komanda_items_split_variant_chk;
alter table public.komanda_items
  add constraint komanda_items_split_variant_chk check (
    (variant_id_2 is null and variant_2_name_snapshot is null)
    or (
      variant_id is not null
      and variant_id_2 is not null
      and variant_id <> variant_id_2
      and variant_2_name_snapshot is not null
    )
  );
