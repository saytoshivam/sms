package com.myhaimi.sms.DTO.studentportal;

import java.util.List;

public record FeeStatementDTO(List<String> financialYears, List<FeeStatementLineDTO> lines) {}
