// src/app/api/orders/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAccessToken } from '@/utils/jwt.util';
import { NotificationService } from '@/lib/notification.service';

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    // ✅ 1. Auth check (admin only)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    // ✅ 2. Get order ID from URL
    const { id } = await params;
    const { status, courier, trackingNumber, reason } = await req.json();

    // ✅ 3. Validate status
    const validStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }

    // ✅ 4. Get order details
    const [orders] = await pool.execute(
      'SELECT user_id, order_id, total_amount FROM orders WHERE id = ? AND is_deleted = FALSE',
      [id]
    );
    const order = (orders as any[])[0];

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // ✅ 5. Update order status
    const updateFields: string[] = ['status = ?', 'updated_at = CURRENT_TIMESTAMP(3)'];
    const updateValues: any[] = [status, id];

    if (status === 'shipped' && courier) {
      updateFields.push('courier = ?', 'tracking_number = ?');
      updateValues.push(courier, trackingNumber || '');
    }

    await pool.execute(
      `UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // ✅ 6. Send notification based on status
    let notificationResult;

    switch (status) {
      case 'shipped':
        notificationResult = await NotificationService.send({
          userId: order.user_id,
          type: 'order',
          templateCode: 'order_shipped',
          variables: {
            order_id: order.order_id,
            courier: courier || 'JNE',
            tracking_number: trackingNumber || '-',
          },
          actionType: 'order_shipped',
          referenceId: id,
        });
        break;

      case 'delivered':
        notificationResult = await NotificationService.send({
          userId: order.user_id,
          type: 'order',
          templateCode: 'order_delivered',
          variables: {
            order_id: order.order_id,
          },
          actionType: 'order_delivered',
          referenceId: id,
        });
        break;

      case 'cancelled':
        notificationResult = await NotificationService.send({
          userId: order.user_id,
          type: 'order',
          templateCode: 'order_cancelled',
          variables: {
            order_id: order.order_id,
            reason: reason || 'Dibatalkan oleh admin',
          },
          actionType: 'order_cancelled',
          referenceId: id,
        });
        break;

      case 'paid':
        notificationResult = await NotificationService.send({
          userId: order.user_id,
          type: 'order',
          templateCode: 'order_paid',
          variables: {
            order_id: order.order_id,
            total_amount: order.total_amount,
          },
          actionType: 'order_paid',
          referenceId: id,
        });
        break;
    }

    return NextResponse.json({
      success: true,
      message: `Order status updated to ${status}`,
      notification: notificationResult,
    });

  } catch (error: any) {
    console.error('Update order status error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}