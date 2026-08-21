import { NextResponse } from 'next/server'

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i

function normalizeApiUrl(url: string): string {
  return url.trim().replace(/\/+$/, '').replace(/\/api$/, '')
}

export async function GET() {
  const publicUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? ''
  const internalUrl = process.env.INTERNAL_API_URL?.trim() ?? ''

  if (publicUrl && ABSOLUTE_URL_PATTERN.test(publicUrl)) {
    return NextResponse.json({ apiUrl: normalizeApiUrl(publicUrl) })
  }

  if (internalUrl && ABSOLUTE_URL_PATTERN.test(internalUrl)) {
    return NextResponse.json({ apiUrl: normalizeApiUrl(internalUrl) })
  }

  return NextResponse.json({ apiUrl: 'http://localhost:3100' })
}
