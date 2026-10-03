begin;

-- statement_month represents the month in which the card bill is due.
-- A purchase made on/before closing day is due in the following month;
-- a purchase after closing day is due one additional month later.
do $$
declare
  v_oid regprocedure;
  v_def text;
begin
  foreach v_oid in array array[
    'app_private.create_card_purchase_impl(uuid,uuid,uuid,date,text,text,uuid,uuid,numeric,integer,text,text)'::regprocedure,
    'app_private.create_card_purchase_cross_company_impl(uuid,uuid,uuid,uuid,date,text,text,uuid,uuid,numeric,integer,text,text)'::regprocedure,
    'public.update_card_purchase(uuid,uuid,uuid,uuid,uuid,date,text,text,uuid,uuid,numeric,integer,text)'::regprocedure
  ]
  loop
    select pg_get_functiondef(v_oid) into v_def;

    v_def := replace(
      v_def,
      'v_first_statement:=date_trunc(''month'',p_purchase_date)::date;' || chr(10) ||
      '  if extract(day from p_purchase_date)::integer>v_card.closing_day then v_first_statement:=(v_first_statement+interval ''1 month'')::date; end if;',
      'v_first_statement:=(date_trunc(''month'',p_purchase_date)+interval ''1 month'')::date;' || chr(10) ||
      '  if extract(day from p_purchase_date)::integer>v_card.closing_day then v_first_statement:=(v_first_statement+interval ''1 month'')::date; end if;'
    );

    v_def := replace(
      v_def,
      'v_first_statement := date_trunc(''month'', p_purchase_date)::date;' || chr(10) ||
      '  if extract(day from p_purchase_date)::integer > v_card.closing_day then' || chr(10) ||
      '    v_first_statement := (v_first_statement + interval ''1 month'')::date;' || chr(10) ||
      '  end if;',
      'v_first_statement := (date_trunc(''month'', p_purchase_date) + interval ''1 month'')::date;' || chr(10) ||
      '  if extract(day from p_purchase_date)::integer > v_card.closing_day then' || chr(10) ||
      '    v_first_statement := (v_first_statement + interval ''1 month'')::date;' || chr(10) ||
      '  end if;'
    );

    v_def := replace(
      v_def,
      'v_first:=date_trunc(''month'',p_purchase_date)::date;' || chr(10) ||
      '  if extract(day from p_purchase_date)::integer>v_card.closing_day then v_first:=(v_first+interval ''1 month'')::date; end if;',
      'v_first:=(date_trunc(''month'',p_purchase_date)+interval ''1 month'')::date;' || chr(10) ||
      '  if extract(day from p_purchase_date)::integer>v_card.closing_day then v_first:=(v_first+interval ''1 month'')::date; end if;'
    );

    execute v_def;
  end loop;
end $$;

commit;
