package project.flametreehotel.Services;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import project.flametreehotel.Model.guest;
import project.flametreehotel.Repository.guestRepository;

@Service
@RequiredArgsConstructor
public class guestService {

    private static final Pattern REQUEST_ID_PATTERN = Pattern.compile("REQ-(\\d+)");

    private final guestRepository repository;

    public List<guest> getAllRequests() {
        return repository.findAll();
    }

    public List<guest> getPendingRoutingRequests() {
        return repository.findByStatusIgnoreCase("Pending").stream()
                .filter(req -> req.getRoutedModule() == null || req.getRoutedModule().isBlank())
                .toList();
    }

    public guest getByRequestId(String requestId) {
        return repository.findByRequestId(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found."));
    }

    public String generateNextRequestId() {
        int max = repository.findAll().stream()
                .map(guest::getRequestId)
                .mapToInt(this::extractSequence)
                .max()
                .orElse(0);

        return String.format("REQ-%03d", max + 1);
    }

    public guest addRequest(String requestId, String roomName, String request) {
        if (repository.findByRequestId(requestId).isPresent()) {
            throw new RuntimeException("Request ID already exists. Please use a unique Request ID.");
        }

        guest newRequest = new guest();
        newRequest.setRequestId(requestId);
        newRequest.setRoomName(roomName);
        newRequest.setRequest(request);
        newRequest.setStatus("Pending");
        newRequest.setRequestDateTime(LocalDateTime.now());
        newRequest.setRoutedModule("");

        return repository.save(newRequest);
    }

    public guest updateRequest(int id, String requestId, String roomName, String request) {
        guest existing = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Request not found."));

        repository.findByRequestId(requestId)
                .filter(record -> record.getId() != id)
                .ifPresent(record -> {
                    throw new RuntimeException("Request ID already exists. Please use a unique Request ID.");
                });

        existing.setRequestId(requestId);
        existing.setRoomName(roomName);
        existing.setRequest(request);

        return repository.save(existing);
    }

    public guest markRouted(String requestId, String moduleName) {
        guest existing = getByRequestId(requestId);

        if (!(existing.getRoutedModule() == null || existing.getRoutedModule().isBlank())) {
            throw new RuntimeException("Request has already been routed to " + existing.getRoutedModule() + ".");
        }

        existing.setRoutedModule(normalizeModule(moduleName));
        existing.setStatus("In Progress");
        return repository.save(existing);
    }

    public guest updateStatusByRequestId(String requestId, String status) {
        guest existing = getByRequestId(requestId);
        existing.setStatus(status);
        return repository.save(existing);
    }

    public void deleteRequest(int id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Request not found.");
        }
        repository.deleteById(id);
    }

    private int extractSequence(String requestId) {
        if (requestId == null) {
            return 0;
        }
        Matcher matcher = REQUEST_ID_PATTERN.matcher(requestId.trim());
        if (!matcher.matches()) {
            return 0;
        }
        try {
            return Integer.parseInt(matcher.group(1));
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private String normalizeModule(String moduleName) {
        String value = moduleName == null ? "" : moduleName.trim().toLowerCase(Locale.ROOT);
        if ("housekeeping".equals(value)) {
            return "Housekeeping";
        }
        if ("maintenance".equals(value)) {
            return "Maintenance";
        }
        throw new RuntimeException("Invalid module. Use housekeeping or maintenance.");
    }
}
