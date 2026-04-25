package com.myhaimi.sms.notifications;

import com.myhaimi.sms.modules.platform.events.FeePaidEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Startup-friendly notifications: structured logs today; swap for email/SMS providers later without a separate JVM.
 */
@Service
@Slf4j
public class InProcessNotificationService {

    public void onFeePaid(FeePaidEvent event) {
        log.info(
                "NOTIFICATION(in-process) fee_paid tenant={} invoice={} paymentId={} student={} amount={} invoiceStatus={} gatewayOrderId={}",
                event.tenantId(),
                event.invoiceId(),
                event.paymentId(),
                event.studentId(),
                event.amount(),
                event.invoiceStatus(),
                event.gatewayOrderId());
    }
}
