# Add Host Header Validation to Prevent DNS Rebinding Attacks

## Problem

The graphql-fake-server currently lacks Host header validation, making it potentially vulnerable to DNS rebinding attacks. While the server implements CORS restrictions, DNS rebinding can bypass these protections by manipulating DNS responses.

### How DNS Rebinding Works

1. Attacker's website (evil.com) is visited by a victim
2. evil.com's DNS initially returns the attacker's server IP
3. After page load, DNS is changed to resolve to 127.0.0.1 (localhost)
4. JavaScript from evil.com can now make requests to the local server
5. The browser sends: `Host: evil.com:4000` while actually connecting to localhost

### Current Security Measures

The server currently implements:
- ✅ CORS origin validation (via `isLocalRequest` and `allowedCORSOrigins`)
- ✅ No static file serving (GraphQL API only)
- ❌ No Host header validation

## Proposed Solution

Add Host header validation with an `allowedHosts` option that defaults to "auto" mode:

```typescript
export type CreateFakeServerOptions = {
    // Existing options
    allowedCORSOrigins?: string[];
    
    // New option
    allowedHosts?: string[] | "auto";  // Default: "auto"
};
```

### "auto" Mode Behavior

When `allowedHosts` is set to "auto" (default), the server will:

1. Allow standard localhost addresses with the server port:
   - `localhost:${serverPort}`
   - `127.0.0.1:${serverPort}`
   - `[::1]:${serverPort}`
   - `0.0.0.0:${serverPort}`

2. Extract and allow hosts from `allowedCORSOrigins`:
   - Original host:port from CORS origins
   - Same hostname with server port (for different frontend/backend ports)

### Example Usage

```typescript
// Default (auto mode)
const server = await createFakeServer({
    schemaFilePath: './schema.graphql',
    ports: { fakeServer: 4000, apolloServer: 4001 }
});

// With CORS origins (auto-generates allowed hosts)
const server = await createFakeServer({
    schemaFilePath: './schema.graphql',
    ports: { fakeServer: 4000, apolloServer: 4001 },
    allowedCORSOrigins: ['http://localhost:3000'],
    // Automatically allows: localhost:4000, 127.0.0.1:4000, localhost:3000
});

// Explicit host list
const server = await createFakeServer({
    schemaFilePath: './schema.graphql',
    ports: { fakeServer: 4000, apolloServer: 4001 },
    allowedHosts: ['special-proxy:8080', 'docker-host:4000']
});
```

## Benefits

1. **Secure by default**: Prevents DNS rebinding attacks out of the box
2. **Developer-friendly**: No additional configuration needed for common cases
3. **Flexible**: Allows explicit configuration when needed
4. **Consistent**: Works well with existing CORS configuration

## Implementation Notes

- Host validation should be implemented as middleware before CORS checks
- Invalid Host headers should return 400 Bad Request
- Log rejected requests for debugging
- Display security configuration on server startup

## References

- [webpack-dev-server DNS rebinding vulnerability (CVE-2018-14732)](https://github.com/webpack/webpack-dev-server/issues/887)
- [Apollo Server security documentation on CORS](https://www.apollographql.com/docs/apollo-server/security/cors)
- [Localhost dangers: CORS and DNS rebinding - GitHub Blog](https://github.blog/security/application-security/localhost-dangers-cors-and-dns-rebinding/)