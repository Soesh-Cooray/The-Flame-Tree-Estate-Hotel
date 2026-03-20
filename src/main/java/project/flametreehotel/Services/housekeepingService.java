package project.flametreehotel.Services;

import java.util.List;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import project.flametreehotel.Model.housekeeping;
import project.flametreehotel.Repository.housekeepingRepository;

@Service
@RequiredArgsConstructor
public class housekeepingService {

    private final housekeepingRepository repository;
    private final guestService guestService;

    public List<housekeeping> getAllTasks() {
        return repository.findAll();
    }

    public housekeeping addTask(String requestId, String room, String requestType, String assignedStaff, String taskStatus) {
        if (repository.findByRequestId(requestId).isPresent()) {
            throw new RuntimeException("Request ID already exists. Please use a unique request ID.");
        }

        housekeeping task = new housekeeping();
        task.setRequestId(requestId);
        task.setRoom(room);
        task.setRequestType(requestType);
        task.setAssignedStaff(assignedStaff);
        task.setTaskStatus(taskStatus);
        task.setApproved(false);

        return repository.save(task);
    }

    public housekeeping addTaskFromGuestRequest(String requestId, String room, String requestType) {
        if (repository.findByRequestId(requestId).isPresent()) {
            throw new RuntimeException("This guest request has already been sent to housekeeping.");
        }

        housekeeping task = new housekeeping();
        task.setRequestId(requestId);
        task.setRoom(room);
        task.setRequestType(requestType);
        task.setAssignedStaff("Unassigned");
        task.setTaskStatus("Assigned");
        task.setApproved(false);

        return repository.save(task);
    }

    public housekeeping updateTask(int id, String requestId, String room, String requestType, String assignedStaff, String taskStatus) {
        housekeeping existing = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found."));

        existing.setRequestId(requestId);
        existing.setRoom(room);
        existing.setRequestType(requestType);
        existing.setAssignedStaff(assignedStaff);
        existing.setTaskStatus(taskStatus);
        existing.setApproved(false);

        return repository.save(existing);
    }

    public housekeeping setApproval(int id, boolean approved) {
        housekeeping existing = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found."));

        if (!"Completed".equalsIgnoreCase(existing.getTaskStatus())) {
            throw new RuntimeException("Only completed tasks can be approved.");
        }

        existing.setApproved(approved);
        housekeeping saved = repository.save(existing);

        if (approved) {
            guestService.updateStatusByRequestId(saved.getRequestId(), "Completed");
        } else {
            guestService.updateStatusByRequestId(saved.getRequestId(), "In Progress");
        }

        return saved;
    }

    public void deleteTask(int id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Task not found.");
        }
        repository.deleteById(id);
    }
}
