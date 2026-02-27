package project.flametreehotel.Services;

import java.util.List;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import project.flametreehotel.Model.orders;
import project.flametreehotel.Repository.ordersRepository;

@Service
@RequiredArgsConstructor
public class ordersService {

    private final ordersRepository repository;

    public List<orders> getAllOrders() {
        return repository.findAll();
    }

    public orders addOrder(String poid, String supplier, String item, int qty, String status) {
        if (repository.findByPoid(poid).isPresent()) {
            throw new RuntimeException("PO ID already exists. Please use a unique PO ID.");
        }

        orders newOrder = new orders();
        newOrder.setPoid(poid);
        newOrder.setSupplier(supplier);
        newOrder.setItem(item);
        newOrder.setQty(qty);
        newOrder.setStatus(status);

        return repository.save(newOrder);
    }

    public orders updateOrder(int id, String poid, String supplier, String item, int qty, String status) {
        orders existing = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Order not found."));

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
}
