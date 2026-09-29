begin;

drop trigger if exists card_installments_prevent_closed_statement on public.card_installments;
drop function if exists app_private.prevent_closed_card_statement_installment();

-- Allow legitimate retroactive card purchases/installments to be recorded.
-- Existing closed statements and their payment history are preserved.

commit;
