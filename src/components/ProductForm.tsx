import { ProductType } from "@/lib/enums";
import { techOptions } from "@/lib/static-data";
import { Upload, X } from "lucide-react";
import Image from "next/image";
import React, { ChangeEvent, useRef, useState } from "react";
import ComboBox from "./ComboBox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import { Badge } from "./ui/badge";
import { Button, buttonVariants } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { SheetClose, SheetFooter, SheetHeader, SheetTitle } from "./ui/sheet";
import { Textarea } from "./ui/textarea";
import { useProductsStore } from "@/providers/ProductsStoreProvider";
import { Product } from "@/lib/models";
import FormButton from "./FormButton";
import { APIResponse } from "@/lib/network";
import { toast } from "sonner";
import { APIRoutes } from "@/routes/routes";
import { useUploadThing } from "@/hooks/useUploadThing";
import { ClientUploadedFileData, UploadedFileData } from "uploadthing/types";

type UploadThingResponse =
  | ClientUploadedFileData<{
      status: string;
      file: UploadedFileData;
    }>[]
  | undefined;

const formFields: { [key in ProductType]: string[] } = {
  [ProductType.IoT]: [
    "icon",
    "name",
    "description",
    "technologies",
    "readme",
    "repositoryLink",
  ],
  [ProductType.Web]: [
    "icon",
    "name",
    "description",
    "technologies",
    "readme",
    "websiteLink",
    "repositoryLink",
  ],
  [ProductType.Mobile]: [
    "icon",
    "name",
    "description",
    "technologies",
    "readme",
    "apk",
    "repositoryLink",
  ],
};

const ProductForm = ({
  productType,
  defaultProduct,
}: {
  productType: ProductType;
  defaultProduct?: Product;
}) => {
  const iconRef = useRef<HTMLInputElement | null>(null);
  const sheetCloseRef = useRef<HTMLButtonElement | null>(null);
  const addProduct = useProductsStore((store) => store.addProduct);
  const updateProduct = useProductsStore((store) => store.updateProduct);
  const removeProduct = useProductsStore((store) => store.removeProduct);
  const { startUpload } = useUploadThing("fileUploader");
  const [product, setProduct] = useState<Product>(
    defaultProduct ?? {
      productName: "",
      productType,
      icon: "",
      description: "",
      readmeMarkup: "",
      repositoryLink: "",
      technologies: "",
      apkLink: "",
      websiteLink: "",
    },
  );
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (e.target.name === "apk") {
          setProduct((product) => ({
            ...product,
            apkLink: reader.result as string,
          }));
        } else {
          setProduct((product) => ({
            ...product,
            icon: reader.result as string,
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTechnologyChanged = (value: string) => {
    setProduct((product) => {
      let technologies = "";
      if (product.technologies.includes(value)) {
        technologies = product.technologies.replace(`${value},`, "");
      } else {
        technologies = product.technologies
          ? product.technologies + value + ","
          : value + ",";
      }
      return { ...product, technologies };
    });
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setProduct((product) => ({ ...product, [e.target.name]: e.target.value }));
  };

  const saveProduct = (product: Product) => {
    if (Boolean(defaultProduct)) {
      updateProduct(product);
    } else {
      addProduct(product);
    }
  };

  const handleDelete = async () => {
    const deletePromise = fetch(APIRoutes.Product, {
      method: "DELETE",
      body: JSON.stringify({ productId: product.productId }),
    });

    toast.promise(deletePromise, {
      loading: "Deleting Product...",
      success: async (data: Response) => {
        removeProduct(product);
        const parsedRes: APIResponse<Product> = await data.json();
        return parsedRes.message;
      },
      error: async (data: Response) => {
        const parsedRes: APIResponse<Product> = await data.json();
        return parsedRes.message;
      },
    });
  };

  const formAction = async (formData: FormData) => {
    const filesToUpload: File[] = [];
    const icon = (formData.get("icon") as File) ?? null;
    const apk = (formData.get("apk") as File) ?? null;

    if (icon.size > 0) filesToUpload.push(icon);
    if (apk.size > 0) filesToUpload.push(apk);

    const onlyUploadingIcon = icon.size > 0 && apk.size <= 0;
    const onlyUploadingAPK = icon.size <= 0 && apk.size > 0;

    let isUploadError = false;

    if (filesToUpload.length > 0) {
      const fileUploadPromise = startUpload(filesToUpload);

      toast.promise(fileUploadPromise, {
        loading: `Uploading ${filesToUpload.length} Files...`,
        success: async (res: UploadThingResponse) => {
          if (onlyUploadingIcon) {
            if (res?.[0].url) {
              formData.set("apk", defaultProduct?.icon ?? "");
              formData.set("icon", res?.[0].url);
            } else {
              formData.set("icon", defaultProduct?.apkLink ?? "");
            }
          } else if (onlyUploadingAPK) {
            if (res?.[0].url) {
              formData.set("icon", defaultProduct?.icon ?? "");
              formData.set("apk", res?.[0].url);
            } else {
              formData.set("apk", defaultProduct?.apkLink ?? "");
            }
          } else {
            if (res?.[0].url) {
              formData.set("icon", res?.[0].url);
            } else {
              formData.set("icon", defaultProduct?.icon ?? "");
            }
            if (res?.[1].url) {
              formData.set("apk", res?.[1].url);
            } else {
              formData.set("apk", defaultProduct?.apkLink ?? "");
            }
          }
          if (Boolean(defaultProduct)) {
            let filesToDelete = "";
            if (icon.size > 0) {
              const iconFileId = defaultProduct?.icon?.split("/");
              if (iconFileId) {
                filesToDelete = iconFileId.pop() + ";";
              }
            }
            if (apk.size > 0) {
              const apkFileId = defaultProduct?.apkLink?.split("/");
              if (apkFileId) {
                filesToDelete += apkFileId.pop() ?? "";
              }
            }
            formData.set("filesToDelete", filesToDelete);
          }
          isUploadError = res == null;
          return isUploadError
            ? "Upload Failed."
            : `${res?.length} Files Uploaded.`;
        },
        error: async () => {
          isUploadError = true;
          return "Upload Failed.";
        },
      });

      await fileUploadPromise;
    } else {
      formData.set("icon", defaultProduct?.icon ?? "");
      formData.set("apk", defaultProduct?.apkLink ?? "");
    }

    if (isUploadError) {
      toast.error("Upload Failed.");
      return;
    }

    const promise = fetch(APIRoutes.Product, {
      method: Boolean(defaultProduct) ? "PATCH" : "POST",
      body: formData,
    });

    toast.promise(promise, {
      loading: `${
        Boolean(defaultProduct) ? "Updating" : "Uploading"
      } Product...`,
      success: async (data: Response) => {
        const parsedRes: APIResponse<Product> = await data.json();
        saveProduct(parsedRes.data!);
        sheetCloseRef.current?.click();
        return parsedRes.message;
      },
      error: async (data: Response) => {
        const parsedRes: APIResponse<Product> = await data.json();
        return parsedRes.message;
      },
    });

    await promise;
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>
          {defaultProduct ? "Update" : "Add"} {productType} App
        </SheetTitle>
      </SheetHeader>
      <form className="my-4 flex flex-col gap-4" action={formAction}>
        <div className="flex flex-col md:flex-row gap-4 md:gap-16 items-center">
          <div>
            <Input
              ref={iconRef}
              name="icon"
              type="file"
              accept="image/png, image/gif, image/jpeg"
              className="hidden"
              onChange={handleFileChange}
            />
            {product.icon ? (
              <Image
                src={product.icon}
                alt="icon Preview"
                height={96}
                width={96}
                className="max-h-24 min-h-24 max-w-24 min-w-24 rounded-full object-cover border border-gray-300 cursor-pointer"
                onClick={() => iconRef.current?.showPicker()}
              />
            ) : (
              <div
                className="h-24 w-24 rounded-full text-xs flex flex-col gap-2 justify-center items-center border border-gray-300 cursor-pointer text-gray"
                onClick={() => iconRef.current?.showPicker()}
              >
                <Upload size={18} color="grey" />
                App Icon
              </div>
            )}
          </div>
          <div className="grid w-full items-center gap-1.5">
            <Label>Product Name</Label>
            <Input
              name="productName"
              placeholder="Product Name"
              value={product.productName}
              onChange={handleChange}
              required
            />
            {Boolean(defaultProduct) && (
              <Input
                name="productId"
                placeholder="Product Id"
                value={product.productId}
                required
                readOnly
              />
            )}
          </div>
        </div>
        <div>
          <div className="flex flex-col md:flex-row gap-4 md:gap-8">
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                name="description"
                placeholder="Description"
                className="h-20 w-full"
                value={product.description}
                onChange={handleChange}
                required
              />
            </div>
            <div className="w-56 flex flex-col gap-2">
              <Label>Technologies</Label>
              <ComboBox
                name="Technologies"
                items={techOptions}
                value={product.technologies}
                onValueChange={handleTechnologyChanged}
              />
              <Input
                name="technologies"
                value={product.technologies}
                className="hidden"
                readOnly
              />
              <div className="flex flex-wrap gap-2">
                {techOptions
                  .filter((tech) => product.technologies.includes(tech.value))
                  .map((tech) => (
                    <Badge
                      key={tech.value}
                      className="text-xs text-white px-1 rounded-full flex items-center justify-between gap-1"
                    >
                      {tech.label}
                      <X
                        color="#fff"
                        size={12}
                        className="hover:cursor-pointer"
                        onClick={() => handleTechnologyChanged(tech.value)}
                      />
                    </Badge>
                  ))}
              </div>
            </div>
            {formFields[productType].includes("apk") && (
              <div>
                <Label>APK</Label>
                <Input
                  name="apk"
                  type="file"
                  accept=".apk"
                  // value={product.apkLink}
                  onChange={handleFileChange}
                />
              </div>
            )}
          </div>
        </div>
        <div className="w-full">
          <div className="w-full">
            <Label>Read me (Markup)</Label>
            <Textarea
              name="readmeMarkup"
              placeholder="Markup md"
              className="h-48"
              value={product.readmeMarkup}
              onChange={handleChange}
              required
            />
          </div>
          <div className="flex flex-col md:flex-row gap-4">
            {formFields[productType].includes("websiteLink") && (
              <div className="w-full my-4">
                <Label>Website Link</Label>
                <Input
                  name="websiteLink"
                  placeholder="Website Link"
                  value={product.websiteLink as string}
                  onChange={handleChange}
                />
              </div>
            )}
            <div className="w-full my-4">
              <Label>Repository Link</Label>
              <Input
                name="repositoryLink"
                placeholder="Repository Link"
                value={product.repositoryLink}
                onChange={handleChange}
                required
              />
            </div>
            <Input
              name="productType"
              placeholder="ProductType"
              className="hidden"
              value={product.productType}
              readOnly
              required
            />
          </div>
        </div>
        <SheetFooter>
          <div className="flex justify-end items-centers gap-4">
            {Boolean(defaultProduct) && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" type="button">
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Are you absolutely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete{" "}
                      {product.productName} product and remove data from
                      servers.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <SheetClose asChild>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className={buttonVariants({ variant: "destructive" })}
                      >
                        Confirm
                      </AlertDialogAction>
                    </SheetClose>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <SheetClose ref={sheetCloseRef} asChild>
              <Button variant="outline">Close</Button>
            </SheetClose>
            {/* <SheetClose> */}
            <FormButton label="Save" />
            {/* </SheetClose> */}
          </div>
        </SheetFooter>
      </form>
    </>
  );
};

export default ProductForm;
