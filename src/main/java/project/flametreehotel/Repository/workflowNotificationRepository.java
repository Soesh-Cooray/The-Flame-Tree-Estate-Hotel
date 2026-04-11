package project.flametreehotel.Repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import project.flametreehotel.Model.workflowNotification;

public interface workflowNotificationRepository extends JpaRepository<workflowNotification, Integer> {
    List<workflowNotification> findTop40ByAudienceOrderByCreatedAtDesc(String audience);
}
