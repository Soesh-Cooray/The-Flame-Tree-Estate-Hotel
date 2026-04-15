package project.flametreehotel.Services;

import java.util.List;
import java.util.Objects;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import project.flametreehotel.Model.inventory;
import project.flametreehotel.Repository.inventoryRepository;

@Service
@RequiredArgsConstructor
public class inventoryService {

    private final inventoryRepository repository;
    private final inventoryApprovalNotificationService notificationService;

    public List<inventory> getAllItems() {
        List<inventory> items = repository.findAll();
        boolean hasStatusChanges = false;

        for (inventory item : items) {
            // Don't recalculate status if it's "Pending" - preserve manual approval status
            if ("Pending".equals(item.getStatus())) {
                continue;
            }

            String recalculatedStatus = computeStatus(
                    item.getInStock(),
                    item.getMinLevel(),
                    item.getDamaged(),
                    item.getMissing());

            if (!Objects.equals(item.getStatus(), recalculatedStatus)) {
                item.setStatus(recalculatedStatus);
                hasStatusChanges = true;
            }
        }

        if (hasStatusChanges) {
            repository.saveAll(items);
        }

        return items;
    }

    public inventory addItem(String item, String category, int inStock, int minLevel) {
        if (repository.findByItem(item).isPresent()) {
            throw new RuntimeException("Item already exists. Use Update on the item row.");
        }

        inventory newItem = new inventory();
        newItem.setItem(item);
        newItem.setCategory(category);
        newItem.setInStock(inStock);
        newItem.setMinLevel(minLevel);
        newItem.setDamaged(0);
        newItem.setMissing(0);
        newItem.setApproved(false);
        newItem.setStatus(computeStatus(inStock, minLevel, 0, 0));

        return repository.save(newItem);
    }

    public inventory updateItem(int id, String item, String category, int inStock, int minLevel, int damaged, int missing) {
        inventory existing = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Item not found."));

        validateStockBreakdown(inStock, damaged, missing);

        existing.setItem(item);
        existing.setCategory(category);
        existing.setInStock(inStock);
        existing.setMinLevel(minLevel);
        existing.setDamaged(damaged);
        existing.setMissing(missing);
        existing.setApproved(false);
        existing.setStatus(computeStatus(inStock, minLevel, damaged, missing));

        return repository.save(existing);
    }

    public void deleteItem(int id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Item not found.");
        }
        repository.deleteById(id);
    }

    public List<inventory> getLowStockPending() {
        List<inventory> items = repository.findAll();
        return items.stream()
                .filter(item -> "Low Stock".equals(item.getStatus()))
                .toList();
    }

    public inventory approveItem(int id, int approvedQty) {
        if (approvedQty < 1) {
            throw new RuntimeException("Approved quantity must be at least 1.");
        }

        inventory item = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Item not found."));
        item.setApproved(true);
        item.setStatus("Pending");
        inventory approvedItem = repository.save(item);
        notificationService.createFromApprovedInventory(approvedItem, "Manager", approvedQty);
        return approvedItem;
    }

    public inventory consumeStock(int id, int usedQty) {
        return consumeStock(id, usedQty, 0);
    }

    public inventory consumeStock(int id, int usedQty, int damagedQty) {
        if (usedQty < 1) {
            throw new RuntimeException("Used quantity must be at least 1.");
        }

        if (damagedQty < 0) {
            throw new RuntimeException("Damaged quantity cannot be negative.");
        }

        inventory item = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Inventory item not found."));

        int currentUsable = Math.max(0, item.getInStock() - Math.max(0, item.getDamaged()) - Math.max(0, item.getMissing()));
        if (currentUsable < usedQty) {
            throw new RuntimeException("Not enough stock available.");
        }

        int updatedStock = item.getInStock() - usedQty;
        int updatedDamaged = item.getDamaged() + damagedQty;

        validateStockBreakdown(updatedStock, updatedDamaged, item.getMissing());

        item.setInStock(updatedStock);
        item.setDamaged(updatedDamaged);
        item.setApproved(false);
        item.setStatus(computeStatus(updatedStock, item.getMinLevel(), updatedDamaged, item.getMissing()));

        return repository.save(item);
    }

    public inventory receiveStock(String itemName, int receivedQty) {
        if (receivedQty < 1) {
            throw new RuntimeException("Received quantity must be at least 1.");
        }

        inventory item = repository.findFirstByItemIgnoreCase(itemName)
                .orElseThrow(() -> new RuntimeException("Inventory item not found for received stock."));

        int updatedStock = item.getInStock() + receivedQty;
        item.setInStock(updatedStock);
        item.setApproved(false);
        item.setStatus(computeStatus(updatedStock, item.getMinLevel(), item.getDamaged(), item.getMissing()));

        return repository.save(item);
    }

    private static final int LOW_STOCK_BUFFER = 10;

    private void validateStockBreakdown(int inStock, int damaged, int missing) {
        if ((damaged + missing) > inStock) {
            throw new RuntimeException("Damaged and missing totals cannot exceed the stock level.");
        }
    }

    private String computeStatus(int inStock, int minLevel, int damaged, int missing) {
    int usableStock = Math.max(0, inStock - Math.max(0, damaged) - Math.max(0, missing));
    int lowStockThreshold = Math.max(0, minLevel) + LOW_STOCK_BUFFER;

    if (usableStock <= lowStockThreshold) {
        return "Low Stock";
    }
        if (damaged > 0 || missing > 0) {
            return "Monitor";
        }
        return "Healthy";
    }
}
