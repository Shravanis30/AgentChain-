import { SiweMessage } from 'siwe';
import { api, setToken, AuthResponse } from './api-client';

export interface SIWEAuthenticateParams {
  address: string;
  chainId: number;
  signMessageAsync: (args: { message: string }) => Promise<string>;
}

export async function authenticateWithSIWE({
  address,
  chainId,
  signMessageAsync,
}: SIWEAuthenticateParams): Promise<AuthResponse> {
  // 1. Fetch single-use nonce from FastAPI backend
  const { nonce } = await api.getSIWENonce(address);

  // 2. Construct standard EIP-4361 SIWE message
  const domain = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const siweMessage = new SiweMessage({
    domain,
    address,
    statement: 'Sign in to AgentChain Protocol with your Ethereum wallet.',
    uri: origin,
    version: '1',
    chainId,
    nonce,
  });

  const messageText = siweMessage.prepareMessage();

  // 3. Request signature from Web3 wallet with a 30-second timeout safeguard
  try {
    const signPromise = signMessageAsync({ message: messageText });
    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              'Signature prompt in MetaMask timed out after 30s. Click "Sign SIWE Nonce" to try again.'
            )
          ),
        30000
      )
    );

    const signature = await Promise.race([signPromise, timeoutPromise]);

    // 4. Verify signature with FastAPI backend & obtain JWT session
    const authResponse = await api.verifySIWE({
      wallet_address: address,
      message: messageText,
      signature,
    });

    // 5. Store JWT token
    if (authResponse.access_token) {
      setToken(authResponse.access_token);
    }

    return authResponse;
  } catch (err: any) {
    if (
      err?.code === 4001 ||
      err?.message?.includes('user rejected') ||
      err?.message?.includes('User denied')
    ) {
      throw new Error('Signature cancelled in MetaMask. Click "Sign SIWE Nonce" to try again.');
    }
    throw err;
  }
}
