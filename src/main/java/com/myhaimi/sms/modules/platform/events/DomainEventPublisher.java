package com.myhaimi.sms.modules.platform.events;

public interface DomainEventPublisher {

    void publishFeePaid(FeePaidEvent event);
}
