-- Phase 3.2: mailbox needs to carry full equipment item rewards (raid wings, azure set
-- pieces) too, not just gold/diamonds/junk stacks.
ALTER TABLE mailbox ADD COLUMN items_json TEXT NOT NULL DEFAULT '';
