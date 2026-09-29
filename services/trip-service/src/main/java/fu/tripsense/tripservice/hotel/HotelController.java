package fu.tripsense.tripservice.hotel;

import static fu.tripsense.tripservice.hotel.HotelDtos.*;
import fu.tripsense.tripservice.security.CurrentUserProvider;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/hotels")
public class HotelController {
  private final HotelService hotels;
  private final CurrentUserProvider users;
  public HotelController(HotelService hotels,CurrentUserProvider users) { this.hotels=hotels; this.users=users; }
  @GetMapping("/search")
  public ResponseEntity<?> search(@RequestParam String destination,@RequestParam LocalDate checkIn,@RequestParam LocalDate checkOut,@RequestParam int guests,@RequestParam int quantity) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(hotels.search(destination,checkIn,checkOut,guests,quantity));
  }
  @GetMapping("/properties") public Object properties() { return hotels.properties(users.get(),false); }
  @GetMapping("/admin/properties") public Object review() { return hotels.properties(users.get(),true); }
  @GetMapping("/properties/{id}") public Object details(@PathVariable UUID id) { return hotels.details(id,users.get()); }
  @PostMapping("/properties") public Object create(@Valid @RequestBody PropertyInput input) { return hotels.saveProperty(users.get(),null,input); }
  @PutMapping("/properties/{id}") public Object update(@PathVariable UUID id,@Valid @RequestBody PropertyInput input) { return hotels.saveProperty(users.get(),id,input); }
  @PostMapping("/properties/{id}/status") public Object status(@PathVariable UUID id,@Valid @RequestBody StatusInput input) { return hotels.status(users.get(),id,input.status()); }
  @GetMapping("/properties/{id}/rooms") public Object rooms(@PathVariable UUID id) { return hotels.rooms(users.get(),id); }
  @PostMapping("/properties/{id}/rooms") public Object room(@PathVariable UUID id,@Valid @RequestBody RoomInput input) { return hotels.createRoom(users.get(),id,input); }
  @PutMapping("/properties/{id}/rooms/{roomId}") public Object editRoom(@PathVariable UUID id,@PathVariable UUID roomId,@Valid @RequestBody RoomInput input) { return hotels.updateRoom(users.get(),id,roomId,input); }
  @GetMapping("/properties/{id}/rooms/{roomId}/inventory") public Object inventory(@PathVariable UUID id,@PathVariable UUID roomId,@RequestParam LocalDate from,@RequestParam LocalDate to) { return hotels.inventory(users.get(),id,roomId,from,to); }
  @PutMapping("/properties/{id}/rooms/{roomId}/inventory") public Map<String,Boolean> inventory(@PathVariable UUID id,@PathVariable UUID roomId,@Valid @RequestBody InventoryInput input) { hotels.setInventory(users.get(),id,roomId,input); return Map.of("updated",true); }
  @PostMapping("/holds") public Object hold(@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody HoldInput input) { return hotels.hold(users.get(),key,input); }
  @PostMapping("/bookings/{id}/confirm") public Object confirm(@PathVariable UUID id) { return hotels.transition(users.get(),id,true); }
  @PostMapping("/bookings/{id}/cancel")
  public Object cancel(@PathVariable UUID id, @RequestBody(required = false) HotelTransitionInput input) {
    if (input != null && input.reason() != null && !input.reason().isBlank()) {
      return hotels.propertyCancel(users.get(), id, input.expectedVersion(), input.reason());
    }
    return hotels.transition(users.get(), id, false);
  }
  @PostMapping("/bookings/{id}/check-in")
  public Object checkIn(@PathVariable UUID id, @RequestBody(required = false) HotelTransitionInput input) {
    return hotels.checkIn(users.get(), id, input != null ? input.expectedVersion() : null);
  }
  @PostMapping("/bookings/{id}/check-out")
  public Object checkOut(@PathVariable UUID id, @RequestBody(required = false) HotelTransitionInput input) {
    return hotels.checkOut(users.get(), id, input != null ? input.expectedVersion() : null);
  }
  @PostMapping("/bookings/{id}/no-show")
  public Object noShow(@PathVariable UUID id, @RequestBody(required = false) HotelTransitionInput input) {
    return hotels.noShow(users.get(), id, input != null ? input.expectedVersion() : null);
  }
  @GetMapping("/bookings") public Object bookings() { return hotels.bookings(users.get(),null); }
  @GetMapping("/properties/{id}/bookings") public Object ownerBookings(@PathVariable UUID id) { return hotels.bookings(users.get(),id); }
  @GetMapping("/notifications") public Object notifications() { return hotels.notifications(users.get()); }
  @PostMapping("/notifications/{id}/read") public Map<String,Boolean> read(@PathVariable UUID id) { hotels.read(users.get(),id); return Map.of("read",true); }
  @GetMapping("/admin/deliveries") public Object deliveries() { return hotels.deliveries(users.get()); }
}
