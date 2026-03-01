package project.flametreehotel.Services;

import java.util.List;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import project.flametreehotel.Model.guest;
import project.flametreehotel.Repository.guestRepository;

@Service
@RequiredArgsConstructor
public class guestService {

    private final guestRepository repository;

    public List<guest> getAllRequests() {
        return repository.findAll();
    }

    public guest addRequest(String requestId, String guestRoom, String request, String assignedStaff, String status) {
        if (repository.findByRequestId(requestId).isPresent()) {
            throw new RuntimeException("Request ID already exists. Please use a unique Request ID.");
        }

        guest newRequest = new guest();
        newRequest.setRequestId(requestId);
        newRequest.setGuestRoom(guestRoom);
        newRequest.setRequest(request);
        newRequest.setAssignedStaff(assignedStaff);
        newRequest.setStatus(status);

        return repository.save(newRequest);
    }

    public guest updateRequest(int id, String requestId, String guestRoom, String request, String assignedStaff, String status) {
        guest existing = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Request not found."));

        existing.setRequestId(requestId);
        existing.setGuestRoom(guestRoom);
        existing.setRequest(request);
        existing.setAssignedStaff(assignedStaff);
        existing.setStatus(status);

        return repository.save(existing);
    }

    public void deleteRequest(int id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Request not found.");
        }
        repository.deleteById(id);
    }
}
