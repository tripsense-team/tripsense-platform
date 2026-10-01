import bcrypt

hashed = b"$2a$10$XOciUsum0LzjcWMoElM2de3s9kKJZzIzpNisYjC4k94Zqqcfy5X7a"
password = b"123456"

print("Matches 123456:", bcrypt.checkpw(password, hashed))
