import assert from 'node:assert/strict';
import {
  DefaultSecretResolver,
  isApprovedPaymentSecretReference,
  APPROVED_PAYMENT_ENV_PREFIX,
} from '../src/modules/finance/secret-resolver.ts';
import {
  normalizeSavePaymentProviderConfigInput,
  toPublicProviderConfigProjection,
  PaymentProviderValidationError,
} from '../src/modules/finance/payment-provider-model.ts';

// 1. PAYMENT_SECRET_ALLOWED_NAMESPACE
{
  assert.equal(isApprovedPaymentSecretReference('env://NEXUS_PAYMENT_ADYEN_HMAC'), true);
  assert.equal(isApprovedPaymentSecretReference('env://NEXUS_PAYMENT_INST_A_SECRET'), true);
  assert.equal(isApprovedPaymentSecretReference('vault://secrets/adyen/inst-a'), true);
  assert.equal(isApprovedPaymentSecretReference('vault://secrets/emis/mock'), true);
  assert.equal(isApprovedPaymentSecretReference('vault://test'), true);

  // Resolution via env variable within allowed namespace
  const testEnvVar = 'NEXUS_PAYMENT_TEST_SECRET_ABC';
  const testSecretValue = 'super-secret-hmac-key-value-12345';
  process.env[testEnvVar] = testSecretValue;

  const resolver = new DefaultSecretResolver();
  const resolved = await resolver.resolveSecret(`env://${testEnvVar}`);
  assert.equal(resolved, testSecretValue);

  // In-memory registered vault reference
  resolver.registerSecret('vault://secrets/adyen/test-inst', 'test-vault-secret-val');
  const resolvedVault = await resolver.resolveSecret('vault://secrets/adyen/test-inst');
  assert.equal(resolvedVault, 'test-vault-secret-val');

  delete process.env[testEnvVar];
  console.log('PAYMENT_SECRET_ALLOWED_NAMESPACE=PASS');
}

// 2. NON_PAYMENT_SECRET_REJECTED
{
  const nonPaymentSecrets = [
    'DATABASE_URL',
    'env://DATABASE_URL',
    'FIREBASE_PRIVATE_KEY',
    'env://FIREBASE_PRIVATE_KEY',
    'GEMINI_API_KEY',
    'env://GEMINI_API_KEY',
    'PATH',
    'env://PATH',
    'AWS_SECRET_ACCESS_KEY',
    'env://AWS_SECRET_ACCESS_KEY',
    'SOME_RANDOM_ENV',
    'env://SOME_RANDOM_ENV',
  ];

  // Set values in process.env to ensure they are NOT resolved despite being in process.env
  process.env.DATABASE_URL = 'dummy-db-connection-string';
  process.env.FIREBASE_PRIVATE_KEY = 'dummy-private-key-mock';
  process.env.GEMINI_API_KEY = 'dummy-gemini-key-mock';

  const resolver = new DefaultSecretResolver();

  for (const invalidRef of nonPaymentSecrets) {
    assert.equal(
      isApprovedPaymentSecretReference(invalidRef),
      false,
      `Reference '${invalidRef}' must NOT be in approved payment secret namespace`
    );

    const resolved = await resolver.resolveSecret(invalidRef);
    assert.equal(
      resolved,
      null,
      `Resolving '${invalidRef}' must return null and never resolve arbitrary process secrets`
    );

    // Registering unapproved reference must throw
    assert.throws(
      () => resolver.registerSecret(invalidRef, 'secret-payload'),
      /namespace aprovado/i,
      `Registering '${invalidRef}' must throw validation error`
    );

    // Validating config input with unapproved reference must reject
    assert.throws(
      () => normalizeSavePaymentProviderConfigInput({
        providerKey: 'adyen',
        environment: 'test',
        status: 'active',
        merchantAccountRef: 'Merchant1',
        supportedCurrencies: ['EUR'],
        enabledMethods: ['card'],
        operationalAvailability: 'available',
        secretReferenceId: invalidRef,
      }),
      (err: any) => err instanceof PaymentProviderValidationError && /namespace aprovado/i.test(err.message)
    );
  }

  delete process.env.DATABASE_URL;
  delete process.env.FIREBASE_PRIVATE_KEY;
  delete process.env.GEMINI_API_KEY;
  console.log('NON_PAYMENT_SECRET_REJECTED=PASS');
}

// 3. RAW_SECRET_NOT_EXPOSED
{
  const secretValue = 'unexposed-hmac-key-999888777';
  const secretRef = 'vault://secrets/adyen/safe-inst';

  const configInput = {
    id: '00000000-0000-0000-0000-000000000888',
    institutionId: '00000000-0000-0000-0000-000000000889',
    providerKey: 'adyen' as const,
    environment: 'test' as const,
    status: 'active' as const,
    merchantAccountRef: 'SafeMerchant',
    supportedCurrencies: ['EUR'],
    enabledMethods: ['card'],
    operationalAvailability: 'available' as const,
    secretReferenceId: secretRef,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    configurationMetadata: {},
  };

  // Public projection strips secretReferenceId
  const publicProj = toPublicProviderConfigProjection(configInput);
  assert.equal((publicProj as any).secretReferenceId, undefined);
  assert.equal(JSON.stringify(publicProj).includes(secretRef), false);
  assert.equal(JSON.stringify(publicProj).includes(secretValue), false);

  // Errors do not leak secret payload
  const resolver = new DefaultSecretResolver();
  try {
    resolver.registerSecret('INVALID_REF', secretValue);
    assert.fail('Should have thrown');
  } catch (err: any) {
    assert.equal(err.message.includes(secretValue), false, 'Error message must NOT contain raw secret value');
  }

  console.log('RAW_SECRET_NOT_EXPOSED=PASS');
}

console.log('Finance Payment Secret Resolver Tests: PASS');
