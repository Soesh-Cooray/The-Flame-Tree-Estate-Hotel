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

        return repository.save(existing);
    }

    public void deleteTask(int id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Task not found.");
        }
        repository.deleteById(id);
    }
}
