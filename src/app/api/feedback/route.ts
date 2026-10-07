export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDbData, saveDbDataAsync } from '@/lib/store';
import { getRequestUser, findRequestEmployee } from '@/lib/requestUser';
import { FeedbackCategory, FeedbackItem, FeedbackStatus } from '@/lib/types';
import { deleteFeedbackFromPrisma } from '@/lib/dbSync';

const ATTACHMENT_DIR = path.join(process.cwd(), 'data', 'feedback_attachments');

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store',
};

function ensureAttachmentDir() {
  try {
    if (!fs.existsSync(ATTACHMENT_DIR)) {
      fs.mkdirSync(ATTACHMENT_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('[feedback] Could not create attachment directory:', err);
  }
}

// GET: Fetch feedback items (Admin gets all, Employee gets their own)
export async function GET(request: Request) {
  try {
    const user = getRequestUser(request);
    const db = getDbData();
    const all = db.feedbackItems || [];

    if (user.role === 'ADMIN') {
      const sorted = [...all].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return NextResponse.json({ success: true, items: sorted }, { headers: NO_CACHE_HEADERS });
    }

    // Identify employee
    const emp = findRequestEmployee(user, db.employees);
    const myId = emp?.id || user.id;
    const myEmail = emp?.email || user.email;

    const myItems = all
      .filter(item => {
        if (myId && item.employeeId === myId) return true;
        if (myEmail && item.employeeEmail && item.employeeEmail.toLowerCase() === myEmail.toLowerCase()) return true;
        return false;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ success: true, items: myItems }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error('[GET /api/feedback] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch feedback items' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

// POST: Submit a new feedback / complaint / suggestion / support request
export async function POST(request: Request) {
  try {
    const user = getRequestUser(request);
    const db = getDbData();
    const emp = findRequestEmployee(user, db.employees);

    const body = await request.json();
    const { category, subject, description, imageBase64, imageName } = body;

    const validCategories: FeedbackCategory[] = ['Complaint', 'Feedback', 'Support', 'Suggestion'];
    if (!category || !validCategories.includes(category)) {
      return NextResponse.json({ error: 'Invalid or missing category.' }, { status: 400 });
    }

    if (!description || typeof description !== 'string' || !description.trim()) {
      return NextResponse.json({ error: 'Description is required.' }, { status: 400 });
    }

    const id = `fb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    let imageUrl: string | undefined = undefined;

    // Handle optional image attachment
    if (imageBase64 && typeof imageBase64 === 'string') {
      try {
        ensureAttachmentDir();
        // Support data URL: "data:image/png;base64,..."
        const match = imageBase64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        let ext = 'jpg';
        let base64Data = imageBase64;
        if (match) {
          ext = match[1] === 'jpeg' ? 'jpg' : match[1];
          base64Data = match[2];
        } else if (imageName && imageName.includes('.')) {
          ext = imageName.split('.').pop()?.toLowerCase() || 'jpg';
        }

        const safeFilename = `${id}.${ext}`;
        const filePath = path.join(ATTACHMENT_DIR, safeFilename);
        const buffer = Buffer.from(base64Data, 'base64');

        fs.writeFileSync(filePath, buffer);
        imageUrl = `/api/feedback/image?id=${id}`;
      } catch (e) {
        console.warn('[feedback] Disk write failed, storing direct data URL fallback:', e);
        // Fallback to storing direct data URL so attachment is never lost
        imageUrl = imageBase64;
      }
    }

    const employeeId = emp?.id || user.id || 'emp-unknown';
    const employeeName = emp?.name || user.email || 'Employee';
    const employeeEmail = emp?.email || user.email || '';
    const department = emp?.department || 'General';

    const newFeedback: FeedbackItem = {
      id,
      employeeId,
      employeeName,
      employeeEmail,
      department,
      category: category as FeedbackCategory,
      subject: subject && typeof subject === 'string' ? subject.trim() : undefined,
      description: description.trim(),
      imageUrl,
      imageName: imageName && typeof imageName === 'string' ? imageName : undefined,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!Array.isArray(db.feedbackItems)) {
      db.feedbackItems = [];
    }
    db.feedbackItems.unshift(newFeedback);

    // Notify admins
    if (Array.isArray(db.notifications)) {
      db.notifications.unshift({
        id: `notif-${Date.now()}`,
        employeeId: 'all-admins',
        type: category === 'Complaint' ? 'COMPLAINT' : 'FEEDBACK',
        title: `New ${category} Received`,
        message: `${employeeName} (${department}) submitted a ${category.toLowerCase()}: "${(subject || description).substring(0, 60)}"`,
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    }

    await saveDbDataAsync(db);

    return NextResponse.json({
      success: true,
      message: 'Your request has been successfully submitted.',
      item: newFeedback
    }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error('[POST /api/feedback] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to submit feedback.' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

// PUT: Update status or reply to feedback (Admin only)
export async function PUT(request: Request) {
  try {
    const user = getRequestUser(request);
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403, headers: NO_CACHE_HEADERS });
    }

    const body = await request.json();
    const { id, status, adminResponse } = body;

    if (!id) {
      return NextResponse.json({ error: 'Feedback ID is required.' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const db = getDbData();
    const items = db.feedbackItems || [];
    const index = items.findIndex(f => f.id === id);

    if (index === -1) {
      return NextResponse.json({ error: 'Feedback item not found.' }, { status: 404, headers: NO_CACHE_HEADERS });
    }

    const item = items[index];
    const validStatuses: FeedbackStatus[] = ['Pending', 'In Review', 'Resolved'];

    if (status && validStatuses.includes(status)) {
      item.status = status;
      if (status === 'Resolved') {
        item.resolvedAt = new Date().toISOString();
      }
    }

    if (adminResponse !== undefined) {
      item.adminResponse = typeof adminResponse === 'string' ? adminResponse.trim() : undefined;
    }

    item.updatedAt = new Date().toISOString();
    items[index] = item;

    // Send notification to employee
    if (Array.isArray(db.notifications)) {
      db.notifications.unshift({
        id: `notif-${Date.now()}`,
        employeeId: item.employeeId,
        type: 'FEEDBACK_UPDATE',
        title: `Your ${item.category} has been updated`,
        message: `Status is now ${item.status}.${item.adminResponse ? ` Response: "${item.adminResponse.substring(0, 60)}"` : ''}`,
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    }

    await saveDbDataAsync(db);

    return NextResponse.json({
      success: true,
      message: 'Feedback updated successfully.',
      item
    }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error('[PUT /api/feedback] Error:', error);
    return NextResponse.json({ error: 'Failed to update feedback.' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

// DELETE: Delete a feedback ticket (Admin only)
export async function DELETE(request: Request) {
  try {
    const user = getRequestUser(request);
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403, headers: NO_CACHE_HEADERS });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Feedback ID is required.' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const db = getDbData();
    db.feedbackItems = (db.feedbackItems || []).filter(f => f.id !== id);

    // Delete attachment if present
    try {
      if (fs.existsSync(ATTACHMENT_DIR)) {
        for (const file of fs.readdirSync(ATTACHMENT_DIR)) {
          if (file.startsWith(id)) {
            fs.unlinkSync(path.join(ATTACHMENT_DIR, file));
          }
        }
      }
    } catch (e) {}

    await deleteFeedbackFromPrisma(id);
    await saveDbDataAsync(db);

    return NextResponse.json({ success: true, message: 'Feedback deleted successfully.' }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error('[DELETE /api/feedback] Error:', error);
    return NextResponse.json({ error: 'Failed to delete feedback.' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
