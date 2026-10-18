import { NextResponse } from 'next/server'

// Shared-secret guard for routes that change data or spend money.
// If PIPELINE_ADMIN_TOKEN is set on the server, the request must send the
// same value in the `x-admin-token` header. If it is NOT set the route stays
// open (fine for read-style actions you run alone; set it before exposing
// anything that sends paid render jobs).
export function adminGuard(req: Request): NextResponse | null {
    const expected = process.env.PIPELINE_ADMIN_TOKEN
    if (!expected) return null
    if (req.headers.get('x-admin-token') === expected) return null
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
}

export const adminTokenRequired = () => Boolean(process.env.PIPELINE_ADMIN_TOKEN)
