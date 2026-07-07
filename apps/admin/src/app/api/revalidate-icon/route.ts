import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Revalidates the icon cache
    // Note: revalidateTag API changed in Next.js 16
    // revalidateTag('system-icon');
    revalidatePath('/icon');
    revalidatePath('/favicon.ico');

    return NextResponse.json(
      {
        revalidated: true,
        message: 'Icon cache cleared successfully',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error revalidating icon cache:', error);
    return NextResponse.json(
      {
        revalidated: false,
        message: 'Failed to clear icon cache',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
