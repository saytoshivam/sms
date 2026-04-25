package com.myhaimi.sms.modules.subscription.domain;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.util.Objects;

@Getter
@Setter
@Entity
@Table(name = "subscription_plan_features")
@IdClass(SubscriptionPlanFeature.PlanFeatureKey.class)
public class SubscriptionPlanFeature {

    @Id
    @Column(name = "plan_id", nullable = false)
    private Long planId;

    @Id
    @Column(name = "feature_id", nullable = false)
    private Long featureId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "plan_id", insertable = false, updatable = false)
    private SubscriptionPlan plan;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "feature_id", insertable = false, updatable = false)
    private SubscriptionFeature feature;

    @Column(nullable = false)
    private Boolean enabled = true;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PlanFeatureKey implements Serializable {
        private Long planId;
        private Long featureId;

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            PlanFeatureKey that = (PlanFeatureKey) o;
            return Objects.equals(planId, that.planId) && Objects.equals(featureId, that.featureId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(planId, featureId);
        }
    }
}
