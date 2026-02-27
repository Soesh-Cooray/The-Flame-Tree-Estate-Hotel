package project.flametreehotel.Services;

import java.util.List;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import project.flametreehotel.Model.inventory;
import project.flametreehotel.Repository.inventoryRepository;

@Service
@RequiredArgsConstructor
public class inventoryService {

    private final inventoryRepository repository;

    public List<inventory> getAllItems() {
        return repository.findAll();
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
        newItem.setStatus(computeStatus(inStock, minLevel, 0, 0));

        return repository.save(newItem);
    }

    public inventory updateItem(int id, String item, String category, int inStock, int minLevel, int damaged, int missing) {
        inventory existing = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Item not found."));

        existing.setItem(item);
        existing.setCategory(category);
        existing.setInStock(inStock);
        existing.setMinLevel(minLevel);
        existing.setDamaged(damaged);
        existing.setMissing(missing);
        existing.setStatus(computeStatus(inStock, minLevel, damaged, missing));

        return repository.save(existing);
    }

    public void deleteItem(int id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Item not found.");
        }
        repository.deleteById(id);
    }

    private String computeStatus(int inStock, int minLevel, int damaged, int missing) {
        if (inStock <= minLevel) {
            return "Low Stock";
        }
        if (damaged > 0 || missing > 0) {
            return "Monitor";
        }
        return "Healthy";
    }
}
