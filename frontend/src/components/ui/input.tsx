import * as React from "react"

import { cn } from "@/lib/utils"

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

// Autocomplete specific interfaces
export interface AutocompleteOption {
  symbol: string;
  name: string;
  exchange?: string;
  type?: string;
}

export interface AutocompleteInputProps extends Omit<InputProps, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string, selectedOption?: AutocompleteOption) => void;
  onSearch: (query: string) => Promise<AutocompleteOption[]>;
  placeholder?: string;
  debounceMs?: number;
  minSearchLength?: number;
  maxSuggestions?: number;
  disabled?: boolean;
}

const AutocompleteInput = React.forwardRef<HTMLInputElement, AutocompleteInputProps>(
  ({ 
    className, 
    value, 
    onChange, 
    onSearch, 
    placeholder = "Search...", 
    debounceMs = 300,
    minSearchLength = 2,
    maxSuggestions = 10,
    disabled = false,
    ...props 
  }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [suggestions, setSuggestions] = React.useState<AutocompleteOption[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
    const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Debounced search function
    const debouncedSearch = React.useCallback(
      (query: string) => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(async () => {
          if (query.length >= minSearchLength) {
            setLoading(true);
            try {
              const results = await onSearch(query);
              setSuggestions(results.slice(0, maxSuggestions));
              setIsOpen(true);
            } catch (error) {
              // Commenting out verbose error logs
              // console.error('Autocomplete search error:', error);
              setSuggestions([]);
            } finally {
              setLoading(false);
            }
          } else {
            setSuggestions([]);
            setIsOpen(false);
          }
        }, debounceMs);
      },
      [onSearch, minSearchLength, maxSuggestions, debounceMs]
    );

    // Handle input changes
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      onChange(newValue, undefined);
      debouncedSearch(newValue);
      setHighlightedIndex(-1);
    };

    // Handle option selection
    const handleOptionSelect = (option: AutocompleteOption) => {
      onChange(option.symbol, option);
      setIsOpen(false);
      setSuggestions([]);
      setHighlightedIndex(-1);
    };

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!isOpen || suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev => 
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => 
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0) {
            handleOptionSelect(suggestions[highlightedIndex]);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    };

    // Close suggestions when clicking outside
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
          setHighlightedIndex(-1);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Cleanup timeout on unmount
    React.useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    return (
      <div ref={containerRef} className="relative w-full">
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        />
        
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
          </div>
        )}

        {isOpen && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-gray-900 border border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto text-gray-100">
            {suggestions.map((option, index) => (
              <div
                key={`${option.symbol}-${index}`}
                className={cn(
                  "px-3 py-2 cursor-pointer hover:bg-gray-700/50 flex justify-between items-center",
                  index === highlightedIndex && "bg-gray-700/50"
                )}
                onClick={() => handleOptionSelect(option)}
              >
                <div className="flex flex-col">
                  <span className="font-medium text-gray-100">{option.symbol}</span>
                  <span className="text-sm text-gray-400 truncate">{option.name}</span>
                </div>
                {option.exchange && (
                  <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">
                    {option.exchange}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);

AutocompleteInput.displayName = "AutocompleteInput";

export { Input, AutocompleteInput } 