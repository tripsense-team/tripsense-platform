import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class check_hash {
    public static void main(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        String hash = "$2a$10$XOciUsum0LzjcWMoElM2de3s9kKJZzIzpNisYjC4k94Zqqcfy5X7a";
        boolean matches = encoder.matches("123456", hash);
        System.out.println("Matches 123456: " + matches);
    }
}
