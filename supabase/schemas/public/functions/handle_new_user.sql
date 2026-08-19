create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        'viewer'
    );
    RETURN NEW;
END;
$function$;

grant execute on function "public"."handle_new_user"() to "postgres", "service_role";

revoke all on function "public"."handle_new_user"() from public;
