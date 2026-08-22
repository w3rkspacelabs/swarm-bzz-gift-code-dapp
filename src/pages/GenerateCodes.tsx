import { useState, useEffect, useRef, useCallback } from 'react';
import type { WalletFormData } from '../components/WalletForm';
import { generateWallets } from '../lib/walletUtils';
import { openQRCodeGrid } from '../lib/qrUtils';
import { useWalletConnection } from '../hooks/useWalletConnection';
import { getConnectedWalletSigner } from '../lib/signerUtils';
import { fundWalletsWithSigner, checkFundingBalanceWithSigner, validateFundParams, checkTokenAllowance } from '../lib/gnosisContract';
import { QRCodeGrid } from '../components/QRCodeGrid';
import type { GiftCode } from '../components/QRCodeGrid';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { ethers } from 'ethers';
import { CONFIG } from '../config';

const GENERATE_FORM_STORAGE_KEY = 'swarm-bzz-gift-code-dapp:generate-form';

function getDefaultFormData(): WalletFormData {
  return {
    xdaiAmount: CONFIG.DEFAULT_XDAI_AMOUNT,
    xbzzAmount: CONFIG.DEFAULT_XBZZ_AMOUNT,
    walletCount: CONFIG.DEFAULT_WALLET_COUNT,
  };
}

function loadFormFromStorage(): WalletFormData {
  const defaults = getDefaultFormData();

  try {
    const stored = localStorage.getItem(GENERATE_FORM_STORAGE_KEY);
    if (!stored) return defaults;

    const parsed = JSON.parse(stored) as Partial<WalletFormData>;
    return {
      xdaiAmount:
        typeof parsed.xdaiAmount === 'number'
          ? parsed.xdaiAmount
          : defaults.xdaiAmount,
      xbzzAmount:
        typeof parsed.xbzzAmount === 'number'
          ? parsed.xbzzAmount
          : defaults.xbzzAmount,
      walletCount:
        typeof parsed.walletCount === 'number'
          ? parsed.walletCount
          : defaults.walletCount,
    };
  } catch {
    return defaults;
  }
}

function getGenerateButtonLabel(walletCount: number, isLoading: boolean): string {
  if (isLoading) return 'Generating...';
  return walletCount === 1
    ? 'Generate 1 code'
    : `Generate ${walletCount} codes`;
}

export function GenerateCodes() {
  const { isConnected, isCorrectNetwork } = useWalletConnection();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);
  const [isLoading, setIsLoading] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [giftCodes, setGiftCodes] = useState<GiftCode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [balanceInfo, setBalanceInfo] = useState<{
    hasSufficientBalance: boolean;
    currentBalance: bigint;
    requiredBalance: bigint;
    shortfall: bigint;
    xbzzBalance: bigint;
    xbzzRequired: bigint;
    xbzzShortfall: bigint;
    hasSufficientXBZZ: boolean;
  } | null>(null);
  const [form, setForm] = useState<WalletFormData>(loadFormFromStorage);
  const balanceCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    localStorage.setItem(GENERATE_FORM_STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type } = e.target;
    const newValue = type === 'number' ? Number(value) : value;
    console.log('handleChange called:', { name, value, newValue });

    setForm((prev) => {
      const updatedForm = {
        ...prev,
        [name]: newValue,
      };

      // Only check balance when user is connected and on correct network
      // and when the form values that affect balance change
      if (isMounted && isConnected && isCorrectNetwork && ['xdaiAmount', 'xbzzAmount', 'walletCount'].includes(name)) {
        // Clear any existing timeout
        if (balanceCheckTimeoutRef.current) {
          clearTimeout(balanceCheckTimeoutRef.current);
        }
        // Set new timeout with the updated form values
        console.log('Setting timeout for balance check with form:', updatedForm);
        balanceCheckTimeoutRef.current = setTimeout(() => {
          checkBalanceOnFormChange(updatedForm);
        }, 500);
      }

      return updatedForm;
    });
  }

  const checkBalanceOnFormChange = useCallback(async (currentForm: WalletFormData) => {
    console.log('checkBalanceOnFormChange called with:', currentForm);
    try {
      const signer = await getConnectedWalletSigner();
      if (!signer) return;

      const balanceCheck = await checkFundingBalanceWithSigner(
        signer,
        currentForm.xdaiAmount,
        currentForm.xbzzAmount,
        currentForm.walletCount
      );

      setBalanceInfo({
        hasSufficientBalance: balanceCheck.hasSufficientBalance,
        currentBalance: balanceCheck.currentBalance,
        requiredBalance: balanceCheck.requiredBalance,
        shortfall: balanceCheck.shortfall,
        xbzzBalance: balanceCheck.xbzzBalance,
        xbzzRequired: balanceCheck.xbzzRequired,
        xbzzShortfall: balanceCheck.xbzzShortfall,
        hasSufficientXBZZ: balanceCheck.hasSufficientXBZZ,
      });
    } catch (error) {
      console.error('Failed to check balance on form change:', error);
      // Don't show error to user for background balance checks
    }
  }, [isConnected, isCorrectNetwork]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBalanceInfo(null);
    setIsLoading(true);
    try {
      if (!isConnected) throw new Error('Please connect your wallet first');
      if (!isCorrectNetwork) throw new Error('Please switch to Gnosis Chain');
      if (form.walletCount < 1) throw new Error('Must generate at least 1 wallet');
      if (form.xdaiAmount < 0.01) throw new Error('xDAI amount must be at least 0.01');

      // Check balance BEFORE generating wallets
      const signer = await getConnectedWalletSigner();
      if (!signer) {
        throw new Error('Failed to get wallet signer');
      }

      const balanceCheck = await checkFundingBalanceWithSigner(
        signer,
        form.xdaiAmount,
        form.xbzzAmount,
        form.walletCount
      );

      setBalanceInfo({
        hasSufficientBalance: balanceCheck.hasSufficientBalance,
        currentBalance: balanceCheck.currentBalance,
        requiredBalance: balanceCheck.requiredBalance,
        shortfall: balanceCheck.shortfall,
        xbzzBalance: balanceCheck.xbzzBalance,
        xbzzRequired: balanceCheck.xbzzRequired,
        xbzzShortfall: balanceCheck.xbzzShortfall,
        hasSufficientXBZZ: balanceCheck.hasSufficientXBZZ,
      });

      // Only generate wallets if there are sufficient funds
      if (!balanceCheck.hasSufficientBalance || !balanceCheck.hasSufficientXBZZ) {
        const errors = [];
        if (!balanceCheck.hasSufficientBalance) {
          errors.push(`xDAI: You need ${ethers.formatEther(balanceCheck.requiredBalance)} xDAI but have ${ethers.formatEther(balanceCheck.currentBalance)} xDAI. Shortfall: ${ethers.formatEther(balanceCheck.shortfall)} xDAI`);
        }
        if (!balanceCheck.hasSufficientXBZZ) {
          errors.push(`xBZZ: You need ${ethers.formatUnits(balanceCheck.xbzzRequired, 16)} xBZZ but have ${ethers.formatUnits(balanceCheck.xbzzBalance, 16)} xBZZ. Shortfall: ${ethers.formatUnits(balanceCheck.xbzzShortfall, 16)} xBZZ`);
        }
        throw new Error(`Insufficient balance to fund wallets. ${errors.join('; ')}`);
      }

      // Generate wallets only if balance is sufficient
      const wallets = generateWallets(form.walletCount);
      setGiftCodes(wallets.map(w => ({ privateKey: w.privateKey, address: w.address })));
      setSuccess(`Generated ${form.walletCount} gift wallet${form.walletCount !== 1 ? 's' : ''} - Ready to fund with ${form.xdaiAmount} xDAI and ${form.xbzzAmount} xBZZ each`);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate codes');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFundWallets() {
    if (giftCodes.length === 0) {
      setError('No wallets to fund. Please generate codes first.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsFunding(true);

    try {
      if (!isConnected) throw new Error('Please connect your wallet first');
      if (!isCorrectNetwork) throw new Error('Please switch to Gnosis Chain');

      const signer = await getConnectedWalletSigner();
      if (!signer) {
        throw new Error('Failed to get wallet signer');
      }

      // Check balance again before funding
      const balanceCheck = await checkFundingBalanceWithSigner(
        signer,
        form.xdaiAmount,
        form.xbzzAmount,
        form.walletCount
      );

      if (!balanceCheck.hasSufficientBalance || !balanceCheck.hasSufficientXBZZ) {
        const errors = [];
        if (!balanceCheck.hasSufficientBalance) {
          errors.push(`xDAI: You need ${ethers.formatEther(balanceCheck.requiredBalance)} xDAI but have ${ethers.formatEther(balanceCheck.currentBalance)} xDAI. Shortfall: ${ethers.formatEther(balanceCheck.shortfall)} xDAI`);
        }
        if (!balanceCheck.hasSufficientXBZZ) {
          errors.push(`xBZZ: You need ${ethers.formatUnits(balanceCheck.xbzzRequired, 16)} xBZZ but have ${ethers.formatUnits(balanceCheck.xbzzBalance, 16)} xBZZ. Shortfall: ${ethers.formatUnits(balanceCheck.xbzzShortfall, 16)} xBZZ`);
        }
        throw new Error(`Insufficient balance. ${errors.join('; ')}`);
      }

      // Prepare funding parameters
      const addresses = giftCodes.map(code => code.address);
      const xdaiAmountWei = ethers.parseEther(form.xdaiAmount.toString());
      const xbzzAmountWei = ethers.parseUnits(form.xbzzAmount.toString(), CONFIG.BZZ_DECIMALS);

      const fundParams = {
        tokenAddress: CONFIG.XBZZ_TOKEN_ADDRESS,
        tokenAmount: xbzzAmountWei,
        nativeAmount: xdaiAmountWei,
        addresses: addresses,
      };

      // Validate parameters
      const validationErrors = validateFundParams(fundParams);
      if (validationErrors.length > 0) {
        throw new Error(`Validation errors: ${validationErrors.join(', ')}`);
      }

      // Check token allowance before funding
      const totalTokenAmount = xbzzAmountWei * BigInt(addresses.length);
      const currentAllowance = await checkTokenAllowance(signer, CONFIG.XBZZ_TOKEN_ADDRESS, CONFIG.FUND_CONTRACT_ADDRESS);

      if (currentAllowance < totalTokenAmount) {
        setSuccess(`Approving xBZZ tokens for the fund contract... This may require a separate transaction.`);
      }

      // Execute funding transaction
      const transaction = await fundWalletsWithSigner(signer, fundParams);

      setSuccess(`Funding transaction submitted! Transaction hash: ${transaction.hash}. Please wait for confirmation.`);

      // Wait for transaction confirmation
      const receipt = await transaction.wait();
      if (receipt) {
        setSuccess(`Successfully funded ${form.walletCount} wallet${form.walletCount !== 1 ? 's' : ''} with ${form.xdaiAmount} xDAI and ${form.xbzzAmount} xBZZ each. Transaction hash: ${receipt.hash}`);
      } else {
        setSuccess(`Successfully funded ${form.walletCount} wallet${form.walletCount !== 1 ? 's' : ''} with ${form.xdaiAmount} xDAI and ${form.xbzzAmount} xBZZ each. Transaction hash: ${transaction.hash}`);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fund wallets');
    } finally {
      setIsFunding(false);
    }
  }

  function handleCopyCodes() {
    if (giftCodes.length === 0) return;
    const codesText = giftCodes.map(code => code.privateKey).join('\n');
    navigator.clipboard.writeText(codesText);
    setSuccess('Gift codes copied to clipboard');
  }

  function handleGenerateQRPage() {
    if (giftCodes.length === 0) return;
    openQRCodeGrid(giftCodes);
  }

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (balanceCheckTimeoutRef.current) {
        clearTimeout(balanceCheckTimeoutRef.current);
      }
    };
  }, []);

  // Remove the automatic balance check on mount to avoid setState during render
  // Balance checks will only happen when user interacts with form inputs

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="walletCount">Number of QR codes (gift wallets) to generate</Label>
          <Input
            id="walletCount"
            name="walletCount"
            type="number"
            min={1}
            max={100}
            value={form.walletCount}
            onChange={handleChange}
            disabled={isLoading}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="xdaiAmount">xDAI per gift wallet</Label>
          <Input
            id="xdaiAmount"
            name="xdaiAmount"
            type="number"
            min={0.01}
            step={0.01}
            value={form.xdaiAmount}
            onChange={handleChange}
            disabled={isLoading}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="xbzzAmount">xBZZ per gift wallet</Label>
          <Input
            id="xbzzAmount"
            name="xbzzAmount"
            type="number"
            min={0}
            step={0.01}
            value={form.xbzzAmount}
            onChange={handleChange}
            disabled={isLoading}
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {getGenerateButtonLabel(form.walletCount, isLoading)}
        </Button>
      </form>

      {error && (
        <Alert>
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-green-500 bg-green-50 text-green-800">
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {balanceInfo && (
        <Alert className={balanceInfo.hasSufficientBalance && balanceInfo.hasSufficientXBZZ ? "border-green-500 bg-green-50 text-green-800" : "border-red-500 bg-red-50 text-red-800"}>
          <AlertTitle>
            {balanceInfo.hasSufficientBalance && balanceInfo.hasSufficientXBZZ ? 'Sufficient Balance' : 'Insufficient Balance'}
          </AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="font-medium">xDAI Balance:</div>
                <div>Current Balance: {ethers.formatEther(balanceInfo.currentBalance)} xDAI</div>
                <div>Required for Funding: {ethers.formatEther(balanceInfo.requiredBalance)} xDAI</div>
                {!balanceInfo.hasSufficientBalance && (
                  <div>Shortfall: {ethers.formatEther(balanceInfo.shortfall)} xDAI</div>
                )}
              </div>

              <div className="space-y-1">
                <div className="font-medium">xBZZ Balance:</div>
                <div>Current Balance: {ethers.formatUnits(balanceInfo.xbzzBalance, 16)} xBZZ</div>
                <div>Required for Funding: {ethers.formatUnits(balanceInfo.xbzzRequired, 16)} xBZZ</div>
                {!balanceInfo.hasSufficientXBZZ && (
                  <div>Shortfall: {ethers.formatUnits(balanceInfo.xbzzShortfall, 16)} xBZZ</div>
                )}
              </div>

              {(!balanceInfo.hasSufficientBalance || !balanceInfo.hasSufficientXBZZ) && (
                <div className="mt-2 text-sm">
                  Please add more {!balanceInfo.hasSufficientBalance ? 'xDAI' : ''}{!balanceInfo.hasSufficientBalance && !balanceInfo.hasSufficientXBZZ ? ' and ' : ''}{!balanceInfo.hasSufficientXBZZ ? 'xBZZ' : ''} to your wallet before generating gift wallets.
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {giftCodes.length > 0 && (
        <Card className="mt-8">
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="font-semibold text-lg">Generated Gift Codes</div>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  type="button"
                  onClick={handleFundWallets}
                  disabled={isFunding || !balanceInfo?.hasSufficientBalance || !balanceInfo?.hasSufficientXBZZ || giftCodes.length === 0}
                >
                  {isFunding ? 'Funding...' : 'Fund Wallets'}
                </Button>
                <Button variant="secondary" type="button" onClick={handleCopyCodes}>
                  Copy Codes
                </Button>
                <Button variant="default" type="button" onClick={handleGenerateQRPage}>
                  Generate QR Page
                </Button>
              </div>
            </div>
            <QRCodeGrid giftCodes={giftCodes} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
