package project.flametreehotel.Controllers;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;
import project.flametreehotel.Model.inventory;
import project.flametreehotel.Services.inventoryService;

@RestController
@RequestMapping("/inventory")
@RequiredArgsConstructor
public class inventroyController {

    private final inventoryService service;

    /**
     * GET /inventory/list
     * Returns all inventory items from the database.
     */
    @GetMapping("/list")
    public ResponseEntity<List<inventory>> listInventory() {
        return ResponseEntity.ok(service.getAllItems());
    }

    /**
     * POST /inventory/add
     * Body: { "item": "...", "category": "...", "inStock": 0, "minLevel": 0 }
     */
    @PostMapping("/add")
    public ResponseEntity<Map<String, Object>> addInventory(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();

        String item = (String) body.get("item");
        String category = (String) body.get("category");

        if (item == null || item.isBlank() || category == null || category.isBlank()) {
            response.put("success", false);
            response.put("message", "Item name and category are required.");
            return ResponseEntity.badRequest().body(response);
        }

        int inStock = body.get("inStock") != null ? ((Number) body.get("inStock")).intValue() : 0;
        int minLevel = body.get("minLevel") != null ? ((Number) body.get("minLevel")).intValue() : 0;

        try {
            inventory created = service.addItem(item.trim(), category, inStock, minLevel);
            response.put("success", true);
            response.put("message", "Added new item: " + created.getItem() + ".");
            response.put("item", created);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * POST /inventory/update
     * Body: { "id": 1, "item": "...", "category": "...", "inStock": 0, "minLevel": 0, "damaged": 0, "missing": 0 }
     */
    @PostMapping("/update")
    public ResponseEntity<Map<String, Object>> updateInventory(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();

        if (body.get("id") == null) {
            response.put("success", false);
            response.put("message", "Item ID is required.");
            return ResponseEntity.badRequest().body(response);
        }

        int id = ((Number) body.get("id")).intValue();
        String item = (String) body.get("item");
        String category = (String) body.get("category");

        if (item == null || item.isBlank() || category == null || category.isBlank()) {
            response.put("success", false);
            response.put("message", "Item name and category are required.");
            return ResponseEntity.badRequest().body(response);
        }

        int inStock = body.get("inStock") != null ? ((Number) body.get("inStock")).intValue() : 0;
        int minLevel = body.get("minLevel") != null ? ((Number) body.get("minLevel")).intValue() : 0;
        int damaged = body.get("damaged") != null ? ((Number) body.get("damaged")).intValue() : 0;
        int missing = body.get("missing") != null ? ((Number) body.get("missing")).intValue() : 0;

        try {
            inventory updated = service.updateItem(id, item.trim(), category, inStock, minLevel, damaged, missing);
            response.put("success", true);
            response.put("message", "Updated " + updated.getItem() + ".");
            response.put("item", updated);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * POST /inventory/delete
     * Body: { "id": 1 }
     */
    @PostMapping("/delete")
    public ResponseEntity<Map<String, Object>> deleteInventory(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();

        if (body.get("id") == null) {
            response.put("success", false);
            response.put("message", "Item ID is required.");
            return ResponseEntity.badRequest().body(response);
        }

        int id = ((Number) body.get("id")).intValue();

        try {
            service.deleteItem(id);
            response.put("success", true);
            response.put("message", "Item deleted successfully.");
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
}
