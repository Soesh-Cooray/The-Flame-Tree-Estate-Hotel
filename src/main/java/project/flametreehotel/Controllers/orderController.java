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
import project.flametreehotel.Model.orders;
import project.flametreehotel.Services.ordersService;

@RestController
@RequestMapping("/orders")
@RequiredArgsConstructor
public class orderController {

    private final ordersService service;

    /**
     * GET /orders/list
     * Returns all purchase orders from the database.
     */
    @GetMapping("/list")
    public ResponseEntity<List<orders>> listOrders() {
        return ResponseEntity.ok(service.getAllOrders());
    }

    /**
     * POST /orders/add
     * Body: { "poid": "...", "supplier": "...", "item": "...", "qty": 0, "status": "..." }
     */
    @PostMapping("/add")
    public ResponseEntity<Map<String, Object>> addOrder(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();

        String poid = (String) body.get("poid");
        String supplier = (String) body.get("supplier");
        String item = (String) body.get("item");
        String status = (String) body.get("status");

        if (poid == null || poid.isBlank() || supplier == null || supplier.isBlank()
                || item == null || item.isBlank() || status == null || status.isBlank()) {
            response.put("success", false);
            response.put("message", "All fields are required.");
            return ResponseEntity.badRequest().body(response);
        }

        int qty = body.get("qty") != null ? ((Number) body.get("qty")).intValue() : 0;
        if (qty < 1) {
            response.put("success", false);
            response.put("message", "Quantity must be at least 1.");
            return ResponseEntity.badRequest().body(response);
        }

        try {
            orders created = service.addOrder(poid.trim(), supplier.trim(), item.trim(), qty, status);
            response.put("success", true);
            response.put("message", "Added purchase order " + created.getPoid() + ".");
            response.put("order", created);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * POST /orders/update
     * Body: { "id": 1, "poid": "...", "supplier": "...", "item": "...", "qty": 0, "status": "..." }
     */
    @PostMapping("/update")
    public ResponseEntity<Map<String, Object>> updateOrder(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();

        if (body.get("id") == null) {
            response.put("success", false);
            response.put("message", "Order ID is required.");
            return ResponseEntity.badRequest().body(response);
        }

        int id = ((Number) body.get("id")).intValue();
        String poid = (String) body.get("poid");
        String supplier = (String) body.get("supplier");
        String item = (String) body.get("item");
        String status = (String) body.get("status");

        if (poid == null || poid.isBlank() || supplier == null || supplier.isBlank()
                || item == null || item.isBlank() || status == null || status.isBlank()) {
            response.put("success", false);
            response.put("message", "All fields are required.");
            return ResponseEntity.badRequest().body(response);
        }

        int qty = body.get("qty") != null ? ((Number) body.get("qty")).intValue() : 0;
        if (qty < 1) {
            response.put("success", false);
            response.put("message", "Quantity must be at least 1.");
            return ResponseEntity.badRequest().body(response);
        }

        try {
            orders updated = service.updateOrder(id, poid.trim(), supplier.trim(), item.trim(), qty, status);
            response.put("success", true);
            response.put("message", "Updated purchase order " + updated.getPoid() + ".");
            response.put("order", updated);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * POST /orders/delete
     * Body: { "id": 1 }
     */
    @PostMapping("/delete")
    public ResponseEntity<Map<String, Object>> deleteOrder(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();

        if (body.get("id") == null) {
            response.put("success", false);
            response.put("message", "Order ID is required.");
            return ResponseEntity.badRequest().body(response);
        }

        int id = ((Number) body.get("id")).intValue();

        try {
            service.deleteOrder(id);
            response.put("success", true);
            response.put("message", "Purchase order deleted successfully.");
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
}
