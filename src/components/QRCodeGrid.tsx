import { useState, useEffect } from 'react';
import { generateQRCodeSVG } from '../lib/qrUtils';

export interface GiftCode {
  privateKey: string;
  address: string;
  xdaiBalance?: string;
  xbzzBalance?: string;
}

interface QRCodeGridProps {
  giftCodes: GiftCode[];
  title?: string;
  className?: string;
}

export function QRCodeGrid({ giftCodes, title = 'Gift Codes', className = '' }: QRCodeGridProps) {
  const [qrCodes, setQrCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const generateQRCodes = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const codes = await Promise.all(
          giftCodes.map(code => generateQRCodeSVG(code.privateKey))
        );
        
        setQrCodes(codes);
      } catch (err) {
        setError('Failed to generate QR codes');
        console.error('Error generating QR codes:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (giftCodes.length > 0) {
      generateQRCodes();
    } else {
      setQrCodes([]);
      setIsLoading(false);
    }
  }, [giftCodes]);

  if (isLoading) {
    return (
      <div className={`qr-code-grid ${className}`}>
        <div className="loading">Generating QR codes...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`qr-code-grid ${className}`}>
        <div className="error">{error}</div>
      </div>
    );
  }

  if (giftCodes.length === 0) {
    return (
      <div className={`qr-code-grid ${className}`}>
        <div className="empty-state">No gift codes to display</div>
      </div>
    );
  }

  return (
    <div className={`qr-code-grid ${className}`}>
      <div className="grid-header">
        <h3>{title}</h3>
        <p>Generated {giftCodes.length} gift wallet{giftCodes.length !== 1 ? 's' : ''}</p>
      </div>
      
      <div className="codes-list">
        {giftCodes.map((code, index) => (
          <div key={index} className="code-item">
            <div className="code-header">
              <span className="code-number">#{index + 1}</span>
              <span className="wallet-address">{code.address}</span>
            </div>
            
            <div className="qr-code-container">
              {qrCodes[index] && (
                <div 
                  className="qr-code"
                  dangerouslySetInnerHTML={{ __html: qrCodes[index] }}
                />
              )}
            </div>
            
            <div className="code-details">
              <div className="private-key">
                <label>Private Key:</label>
                <code>{code.privateKey}</code>
              </div>
              
              {code.xdaiBalance !== undefined && (
                <div className="balance xdai">
                  <label>xDAI Balance:</label>
                  <span>{code.xdaiBalance}</span>
                </div>
              )}
              
              {code.xbzzBalance !== undefined && (
                <div className="balance xbzz">
                  <label>xBZZ Balance:</label>
                  <span>{code.xbzzBalance}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 