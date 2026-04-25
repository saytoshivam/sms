package com.myhaimi.sms.modules.platform.security;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.FORBIDDEN)
public class FeatureAccessDeniedException extends RuntimeException {
    public FeatureAccessDeniedException(String message) {
        super(message);
    }
}
