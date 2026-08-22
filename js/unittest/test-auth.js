import test from 'node:test';
import assert from 'node:assert';
import {
    decodeJWTPayload,
    isLoggedIn
} from '../auth.js';

test('auth - decode valid JWT payload', (t) => {
    // Header: {"alg":"HS256","typ":"JWT"}
    // Payload: {"userId":"staff_001","fullName":"Trần Thị Mai","role":"branch_manager","branchId":"branch_q10","exp":1893456000}
    const mockToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJzdGFmZl8wMDEiLCJmdWxsTmFtZSI6IlRyw6JuIFRo4buLIE1haSIsInJvbGUiOiJicmFuY2hfbWFuYWdlciIsImJyYW5jaElkIjoiYnJhbmNoX3ExMCIsImV4cCI6MTg5MzQ1NjAwMH0.dummySignature";

    const payload = decodeJWTPayload(mockToken);
    assert.ok(payload, "Payload không được null");
    assert.strictEqual(payload.userId, "staff_001");
    assert.strictEqual(payload.role, "branch_manager");
    assert.strictEqual(payload.branchId, "branch_q10");
});

test('auth - decode invalid or malformed JWT token', (t) => {
    assert.strictEqual(decodeJWTPayload(""), null);
    assert.strictEqual(decodeJWTPayload("invalid.token"), null);
    assert.strictEqual(decodeJWTPayload(null), null);
    assert.strictEqual(decodeJWTPayload("a.b.c.d"), null);
});
