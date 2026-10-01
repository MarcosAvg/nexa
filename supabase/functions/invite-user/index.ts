import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';

/**
 * invite-user — Invita un usuario por email con rol preasignado.
 *
 * Solo administradores activos. Usa `auth.admin.inviteUserByEmail`
 * (service_role); el trigger `handle_new_user` crea el perfil y aquí se
 * le asigna el rol elegido.
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_ROLES = ['viewer', 'operator', 'admin'];

function json(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const authHeader = req.headers.get('Authorization') ?? '';

        const caller = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } },
            auth: { persistSession: false },
        });
        const {
            data: { user },
        } = await caller.auth.getUser();
        if (!user) return json({ error: 'No autorizado' }, 401);

        const { data: profile } = await caller
            .from('profiles')
            .select('role,is_active')
            .eq('id', user.id)
            .single();
        if (!profile || profile.role !== 'admin' || profile.is_active === false) {
            return json({ error: 'Solo un administrador activo puede invitar usuarios' }, 403);
        }

        const { email, full_name, role } = await req.json();
        if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return json({ error: 'Correo inválido' }, 400);
        }
        if (!VALID_ROLES.includes(role)) {
            return json({ error: 'Rol inválido' }, 400);
        }

        const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
        const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
            data: { full_name: full_name ?? '' },
        });
        if (inviteError) throw inviteError;

        if (role && role !== 'viewer') {
            const { error: roleError } = await admin
                .from('profiles')
                .update({ role })
                .eq('id', invited.user.id);
            if (roleError) throw roleError;
        }

        return json({ ok: true, id: invited.user.id }, 200);
    } catch (e) {
        return json({ error: e instanceof Error ? e.message : 'Error al invitar' }, 400);
    }
});
