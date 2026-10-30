"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { LoaderCircle, Minus, Plus, Upload, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { VoiceInput } from "@/components/ui/voice-input";
import { toast } from "sonner";
import { deleteProductImage, uploadProductImage } from "@/lib/supabase/storage";
import type { Product, ProductInput } from "@/lib/products";

type ProductFormModalProps = {
  mode: "create" | "edit";
  product?: Product;
  onClose: () => void;
  /** Should throw with a message when the save fails. */
  onSubmit: (values: ProductInput) => Promise<void>;
};

const LABEL_CLASS = "mb-1 block text-sm font-medium text-gray-700";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20";

/**
 * Formats a raw digit string as thousands-with-commas for display in the price
 * field. Non-digits are stripped, and "" stays "".
 */
function formatNairaInput(value: string): string {
  return value.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function ProductFormModal({
  mode,
  product,
  onClose,
  onSubmit,
}: ProductFormModalProps) {
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(
    product ? String(product.price) : "",
  );
  const [priceFocused, setPriceFocused] = useState(false);
  const [floorPrice, setFloorPrice] = useState(
    product?.floorPrice != null ? String(product.floorPrice) : "",
  );
  const [negotiable, setNegotiable] = useState(product?.negotiable ?? false);
  const [stock, setStock] = useState(
    product?.stock != null ? String(product.stock) : "",
  );
  const [description, setDescription] = useState(product?.description ?? "");
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  // A new product has no id yet, so uploads go under a generated folder. The
  // URLs are stored as-is, so the folder name never has to match the product.
  const folderIdRef = useRef<string | null>(null);
  // Uploads made in this session that are not saved yet; removing one of these
  // also removes it from storage so cancelled forms leave nothing behind.
  const sessionUploadsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;

    fetch("/api/business")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { business?: { id?: string } } | null) => {
        if (active) {
          setBusinessId(data?.business?.id ?? null);
        }
      })
      .catch(() => {
        // Leave businessId null; the upload button explains what to do.
      });

    return () => {
      active = false;
    };
  }, []);

  function getFolderId(): string {
    if (!folderIdRef.current) {
      folderIdRef.current = crypto.randomUUID();
    }
    return folderIdRef.current;
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    setUploadError(null);

    if (!businessId) {
      setUploadError("Still loading your business. Try again in a moment.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setUploading(true);

    try {
      const productId = product?.id ?? getFolderId();
      const uploaded: string[] = [];

      for (const file of files) {
        const url = await uploadProductImage(businessId, productId, file);
        uploaded.push(url);
        sessionUploadsRef.current.add(url);
      }

      setImages((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((item) => item !== url));

    if (sessionUploadsRef.current.has(url)) {
      sessionUploadsRef.current.delete(url);
      deleteProductImage(url).catch(() => {
        // Best-effort cleanup; the image is already out of the form.
      });
    }
  }

  function handlePriceChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value.replace(/\D/g, "");
    setPrice(raw);
  }

  function bumpPrice(delta: number) {
    setPrice((current) => {
      const base = current === "" ? 0 : Number(current);
      return String(Math.max(0, base + delta));
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setHasAttemptedSave(true);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Product name is required.");
      return;
    }

    if (price.trim() === "") {
      setError("Price is required.");
      return;
    }
    const priceValue = Number(price);
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      setError("Enter a valid price (0 or more).");
      return;
    }

    // Floor price is optional: blank means "AI never goes below the list
    // price" (saved as null).
    let floorPriceValue: number | null = null;
    if (floorPrice.trim() !== "") {
      const parsedFloor = Number(floorPrice);
      if (!Number.isFinite(parsedFloor) || parsedFloor < 0) {
        setError("Enter a valid floor price (0 or more), or leave it blank.");
        return;
      }
      if (parsedFloor > priceValue) {
        setError("Floor price cannot be higher than the price.");
        return;
      }
      floorPriceValue = parsedFloor;
    }

    if (description.trim() === "") {
      setError("Description is required.");
      return;
    }

    // Stock is optional: blank means "not tracked" and is saved as null.
    let stockValue: number | null = null;
    if (stock.trim() !== "") {
      const parsedStock = Number(stock);
      if (!Number.isInteger(parsedStock) || parsedStock < 0) {
        setError("Enter a valid stock quantity (0 or more), or leave it blank.");
        return;
      }
      stockValue = parsedStock;
    }

    setSaving(true);
    setError(null);

    try {
      await onSubmit({
        name: trimmedName,
        price: priceValue,
        floorPrice: floorPriceValue,
        negotiable,
        stock: stockValue,
        description: description.trim(),
        images,
      });
      toast.success(
        mode === "create" ? "Product added!" : "Product updated!",
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      toast.error("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  return (
    <Modal
      title={mode === "create" ? "Add Product" : "Edit Product"}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2 pt-1 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 sm:flex-none inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
            <Button form="product-form" type="submit" variant="primary" isLoading={saving} className="flex-1 sm:flex-none">
            {mode === "create" ? "Save Product" : "Save Changes"}
          </Button>
        </div>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="product-name" className={LABEL_CLASS}>
            Name
          </label>
          <input
            id="product-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={'e.g. Hisense 32" LED TV'}
            className={INPUT_CLASS}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="product-price" className={LABEL_CLASS}>
              Price (₦)
            </label>
            <div className="flex items-stretch gap-1">
              <button
                type="button"
                onClick={() => bumpPrice(-1000)}
                aria-label="Decrease price by 1000"
                title="Decrease by 1000"
                className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-gray-300 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                <Minus className="h-4 w-4" aria-hidden />
              </button>
              <input
                id="product-price"
                type="text"
                inputMode="numeric"
                value={priceFocused ? price : formatNairaInput(price)}
                onChange={handlePriceChange}
                onFocus={() => setPriceFocused(true)}
                onBlur={() => setPriceFocused(false)}
                placeholder="e.g. 145000"
                className={INPUT_CLASS}
              />
              <button
                type="button"
                onClick={() => bumpPrice(1000)}
                aria-label="Increase price by 1000"
                title="Increase by 1000"
                className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-gray-300 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                <Plus className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="product-stock" className={LABEL_CLASS}>
              Stock
            </label>
            <input
              id="product-stock"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={stock}
              onChange={(event) => setStock(event.target.value)}
              placeholder="Optional"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div>
          <label htmlFor="product-floor-price" className={LABEL_CLASS}>
            Floor Price (₦)
          </label>
          <input
            id="product-floor-price"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={floorPrice}
            onChange={(event) => setFloorPrice(event.target.value)}
            placeholder="Optional"
            className={INPUT_CLASS}
          />
          <p className="mt-1 text-[13px] text-gray-500">
            Lowest you&apos;ll accept. AI will not negotiate below this.
          </p>
          <label
            htmlFor="product-negotiable"
            className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-gray-700"
          >
            <input
              id="product-negotiable"
              type="checkbox"
              checked={negotiable}
              onChange={(event) => setNegotiable(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-colly accent-[#FF6600] focus:ring-colly/20"
            />
            Allow AI to negotiate this price
          </label>
        </div>

        <div>
          <div className="mb-1 flex items-center gap-2">
            <label
              htmlFor="product-description"
              className="block text-sm font-medium text-gray-700"
            >
              Description
            </label>
            <VoiceInput
              onTranscript={(transcript) =>
                setDescription((prev) =>
                  prev ? `${prev}\n${transcript}` : transcript,
                )
              }
            />
          </div>
          <textarea
            id="product-description"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              if (hasAttemptedSave && error === "Description is required.") {
                setError(null);
              }
            }}
            placeholder="Describe this product. Include condition, specs, and what's in the box."
            className={`${INPUT_CLASS} min-h-[180px] resize-none overflow-y-auto`}
            style={{ minHeight: "180px", resize: "none", overflowY: "auto" }}
          />
          {hasAttemptedSave && description.trim() === "" && (
            <p className="mt-1.5 text-[13px] text-danger">
              Description is required.
            </p>
          )}
        </div>

        <div>
          <span className={LABEL_CLASS}>Images</span>
          <div className="flex flex-wrap gap-2">
            {images.map((url) => (
              <div
                key={url}
                className="relative h-20 w-20 overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
              >
                {/* Product images may point at our Supabase bucket (uploads) or
                    at a third-party CDN (Jiji import), so `next/image` has no
                    host allow-list to work with. Sized + lazy by hand. The alt
                    stays empty because the remove button below is the labelled
                    control for this thumbnail. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  width={80}
                  height={80}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(url)}
                  aria-label="Remove image"
                  title="Remove"
                  className="absolute right-0 top-0 inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-white"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900/70">
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 text-gray-400 transition-colors hover:border-colly hover:text-colly disabled:opacity-50"
            >
              {uploading ? (
                <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <Upload className="h-5 w-5" aria-hidden />
              )}
              <span className="text-[11px] font-medium">
                {uploading ? "Uploading" : "Upload"}
              </span>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFiles}
            className="hidden"
          />
          {uploadError && (
            <p className="mt-1 text-sm text-danger">{uploadError}</p>
          )}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
