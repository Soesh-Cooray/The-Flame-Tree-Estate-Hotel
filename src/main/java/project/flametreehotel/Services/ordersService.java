package project.flametreehotel.Services;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import project.flametreehotel.Model.orders;
import project.flametreehotel.Repository.ordersRepository;

@Service
@RequiredArgsConstructor
public class ordersService {

    private static final Pattern PO_ID_PATTERN = Pattern.compile("PO-(\\d+)");

    private final ordersRepository repository;
    private final inventoryApprovalNotificationService notificationService;

    public List<orders> getAllOrders() {
        return repository.findAll();
    }

    public String generateNextPoId() {
        int max = repository.findAll().stream()
                .map(orders::getPoid)
                .mapToInt(this::extractPoSequence)
                .max()
                .orElse(0);

        return String.format("PO-%03d", max + 1);
    }

    @Transactional
    public orders addOrder(String supplier, String item, int qty, String status, Integer notificationId) {
        String poid = generateNextPoId();
        if (repository.findByPoid(poid).isPresent()) {
            throw new RuntimeException("PO ID already exists. Please use a unique PO ID.");
        }

        orders newOrder = new orders();
        newOrder.setPoid(poid);
        newOrder.setSupplier(supplier);
        newOrder.setItem(item);
        newOrder.setQty(qty);
        newOrder.setStatus(status);

        orders saved = repository.save(newOrder);

        if (notificationId != null) {
            notificationService.markOrdered(notificationId, saved.getId());
        }

        return saved;
    }

    public orders updateOrder(int id, String poid, String supplier, String item, int qty, String status) {
        orders existing = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Order not found."));

        repository.findByPoid(poid)
                .filter(order -> order.getId() != id)
                .ifPresent(order -> {
                    throw new RuntimeException("PO ID already exists. Please use a unique PO ID.");
                });

        existing.setPoid(poid);
        existing.setSupplier(supplier);
        existing.setItem(item);
        existing.setQty(qty);
        existing.setStatus(status);

        return repository.save(existing);
    }

    public void deleteOrder(int id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Order not found.");
        }
        repository.deleteById(id);
    }

    private int extractPoSequence(String poid) {
        if (poid == null) {
            return 0;
        }

        Matcher matcher = PO_ID_PATTERN.matcher(poid.trim().toUpperCase());
        if (!matcher.matches()) {
            return 0;
        }

        try {
            return Integer.parseInt(matcher.group(1));
        } catch (NumberFormatException ex) {
            return 0;
        }
    }
}
