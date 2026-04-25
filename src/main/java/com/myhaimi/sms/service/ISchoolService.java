package com.myhaimi.sms.service;

import com.myhaimi.sms.DTO.SchoolRegistrationDTO;
import com.myhaimi.sms.DTO.SchoolBrandingDTO;
import com.myhaimi.sms.DTO.SchoolThemeUpdateDTO;
import com.myhaimi.sms.entity.School;

public interface ISchoolService {
    School registerSchoolForMyHaimiPlatform(SchoolRegistrationDTO dto, String actorEmail);

    SchoolBrandingDTO getBrandingByCode(String schoolCode);

    School updateTheme(SchoolThemeUpdateDTO dto, boolean superAdmin);
}

