package fu.tripsense.apigateway;

import io.netty.util.NetUtil;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ServerWebExchange;

import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.util.ArrayList;
import java.util.List;

final class TrustedProxyClientIpResolver {

    static final String UNKNOWN_CLIENT = "unknown-client";
    private static final String X_FORWARDED_FOR = "X-Forwarded-For";

    private final List<CidrBlock> trustedProxies;

    TrustedProxyClientIpResolver(List<String> trustedProxyCidrs) {
        this.trustedProxies = trustedProxyCidrs == null
                ? List.of()
                : trustedProxyCidrs.stream()
                        .filter(StringUtils::hasText)
                        .map(String::trim)
                        .map(CidrBlock::parse)
                        .toList();
    }

    String resolve(ServerWebExchange exchange) {
        InetSocketAddress remoteAddress = exchange.getRequest().getRemoteAddress();
        InetAddress immediatePeer = remoteAddress == null ? null : remoteAddress.getAddress();
        if (immediatePeer == null) {
            return UNKNOWN_CLIENT;
        }

        if (!isTrusted(immediatePeer)) {
            return immediatePeer.getHostAddress();
        }

        List<InetAddress> forwardedChain = parseForwardedChain(
                exchange.getRequest().getHeaders().get(X_FORWARDED_FOR));
        for (int index = forwardedChain.size() - 1; index >= 0; index--) {
            InetAddress candidate = forwardedChain.get(index);
            if (!isTrusted(candidate)) {
                return candidate.getHostAddress();
            }
        }

        return forwardedChain.isEmpty()
                ? immediatePeer.getHostAddress()
                : forwardedChain.get(0).getHostAddress();
    }

    private List<InetAddress> parseForwardedChain(List<String> headerValues) {
        if (headerValues == null || headerValues.isEmpty()) {
            return List.of();
        }

        List<InetAddress> addresses = new ArrayList<>();
        for (String headerValue : headerValues) {
            for (String value : headerValue.split(",")) {
                InetAddress address = NetUtil.createInetAddressFromIpAddressString(value.trim());
                if (address != null) {
                    addresses.add(address);
                }
            }
        }
        return addresses;
    }

    private boolean isTrusted(InetAddress address) {
        return trustedProxies.stream().anyMatch(cidr -> cidr.contains(address));
    }

    private record CidrBlock(byte[] networkAddress, int prefixLength) {

        static CidrBlock parse(String value) {
            String[] parts = value.split("/", -1);
            if (parts.length != 2) {
                throw new IllegalArgumentException("Trusted proxy must use CIDR notation: " + value);
            }

            InetAddress address = NetUtil.createInetAddressFromIpAddressString(parts[0].trim());
            if (address == null) {
                throw new IllegalArgumentException("Trusted proxy CIDR has an invalid IP address: " + value);
            }

            int prefixLength;
            try {
                prefixLength = Integer.parseInt(parts[1].trim());
            } catch (NumberFormatException exception) {
                throw new IllegalArgumentException("Trusted proxy CIDR has an invalid prefix: " + value, exception);
            }

            int maximumPrefix = address.getAddress().length * Byte.SIZE;
            if (prefixLength < 0 || prefixLength > maximumPrefix) {
                throw new IllegalArgumentException("Trusted proxy CIDR prefix is out of range: " + value);
            }
            return new CidrBlock(address.getAddress(), prefixLength);
        }

        boolean contains(InetAddress candidate) {
            byte[] candidateAddress = candidate.getAddress();
            if (networkAddress.length != candidateAddress.length) {
                return false;
            }

            int fullBytes = prefixLength / Byte.SIZE;
            int remainingBits = prefixLength % Byte.SIZE;
            for (int index = 0; index < fullBytes; index++) {
                if (networkAddress[index] != candidateAddress[index]) {
                    return false;
                }
            }

            if (remainingBits == 0) {
                return true;
            }

            int mask = 0xFF << (Byte.SIZE - remainingBits);
            return (networkAddress[fullBytes] & mask) == (candidateAddress[fullBytes] & mask);
        }
    }
}
