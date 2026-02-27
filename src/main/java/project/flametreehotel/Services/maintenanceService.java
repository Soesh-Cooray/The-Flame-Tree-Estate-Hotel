package project.flametreehotel.Services;

import java.util.List;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import project.flametreehotel.Model.maintenance;
import project.flametreehotel.Repository.maintenanceRepository;

@Service
@RequiredArgsConstructor
public class maintenanceService {

    private final maintenanceRepository repository;

    public List<maintenance> getAllTickets() {
        return repository.findAll();
    }

    public maintenance addTicket(String ticket, String location, String issue, String assignedTo, String status) {
        if (repository.findByTicket(ticket).isPresent()) {
            throw new RuntimeException("Ticket ID already exists. Please use a unique ticket ID.");
        }

        maintenance newTicket = new maintenance();
        newTicket.setTicket(ticket);
        newTicket.setLocation(location);
        newTicket.setIssue(issue);
        newTicket.setAssignedTo(assignedTo);
        newTicket.setStatus(status);

        return repository.save(newTicket);
    }

    public maintenance updateTicket(int id, String ticket, String location, String issue, String assignedTo, String status) {
        maintenance existing = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Ticket not found."));

        existing.setTicket(ticket);
        existing.setLocation(location);
        existing.setIssue(issue);
        existing.setAssignedTo(assignedTo);
        existing.setStatus(status);

        return repository.save(existing);
    }

    public void deleteTicket(int id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Ticket not found.");
        }
        repository.deleteById(id);
    }
}
