// Select elements for file upload zone and thumbnail display
const dropZone = document.querySelector("html");
const fileZone = document.querySelector("#upload-files");
const thumbnailDiv = document.querySelector("#thumbnails");
let fileList = []; // Array to keep track of validated files
let browserZoomLevel = getBrowserZoomLevel();
const menuButton = document.querySelector("#toggle-menu-button");



// Load the fileList from localStorage when the page loads
fileList = loadFileListFromLocalStorage();

// Generate thumbnails for stored files in fileList
fileList.forEach(file => generateThumbnail(file));

console.log("Initial fileList:", fileList);
if (fileList.length == 0) {
    displayStartMessage();
}

// Event listener for drag-and-drop functionality
dropZone.addEventListener("dragover", (e) => {
    e.preventDefault(); // Prevent default behavior to allow drop
});

dropZone.addEventListener("drop", (e) => {
    e.preventDefault(); // Prevent default behavior for drop event
    console.log("Files dropped");
    const files = e.dataTransfer.files; // Retrieve files from the event
    addFiles(files); // Add files to the file list
});

// Event listener for file selection via input field
fileZone.addEventListener("change", (e) => {
    console.log("Files uploaded through input");
    addFiles(fileZone.files); // Add files to the file list
});

menuButton.addEventListener("click", (e) => {
    const menuDiv = document.querySelector("#toggle-menu");
    if (menuDiv.className == "hidden"){
        menuDiv.classList.remove("hidden");
        menuButton.querySelector("img").src="Images/arrow-left.svg";

    }
    else{
        menuDiv.className = "hidden";
        menuButton.querySelector("img").src="Images/arrow-right.svg";
    }
});

document.querySelector("#trash-btn").addEventListener("click", trashFiles);


function displayStartMessage() {
    
}

// Load file list from localStorage and convert objects back to File instances
function loadFileListFromLocalStorage() {
    const savedList = localStorage.getItem("fileList");
    if (savedList) {
        const parsedList = JSON.parse(savedList);
        return parsedList.map(fileData => {
            //Base64 string to recreate the Blob and File
            const byteString = atob(fileData.data.split(',')[1]); // Decode Base64
            const mimeString = fileData.data.split(',')[0].split(':')[1].split(';')[0]; // Get MIME type
            const byteNumbers = new Array(byteString.length).fill(null).map((_, i) => byteString.charCodeAt(i));
            const byteArray = new Uint8Array(byteNumbers);

            return new File([new Blob([byteArray], { type: mimeString })], fileData.name, {
                type: fileData.type,
                size: fileData.size,
            });
        });
    }
    return [];
}

// Add new files, validate them, and update the file list
function addFiles(files) {
    console.log("Processing files:", files);
    const validationPromises = []; // Track validation promises for asynchronous handling

    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Skip files that are not PNGs
        if (file.type !== "image/png") {
            console.warn(`${file.name} is not a PNG file.`);
            continue;
        }

		// Validate dimensions of the file asynchronously
        const validationPromise = validateDimensions(file)
            .then(isValid => {
                if (isValid) {
                    // Add file to the list if it's not a duplicate
                    if (!fileList.some(existingFile => existingFile.name === file.name && existingFile.size === file.size)) {
                        fileList.push(file); // Add validated file
                        console.log(`${file.name} added to fileList.`);
                        generateThumbnail(file); // Generate a thumbnail for the file
                        saveFileListToLocalStorage(); // Save the updated list to localStorage
                    } else {
                        console.warn(`${file.name} is already in the file list.`);
                    }
                } else {
                    console.warn(`${file.name} does not meet the dimension requirements.`);
                }
            })
            .catch(error => console.error(`Error validating file ${file.name}:`, error));

        validationPromises.push(validationPromise); // Store each validation promise
    }

    // Log the updated fileList after all validations are done
    Promise.all(validationPromises)
        .then(() => {
            console.log("Current fileList:", fileList);

            // Reset the input element to allow re-upload of the same file
            fileZone.value = ""; // Clear the value of the input element
        });
}

// Generate a thumbnail for a validated file and display it
function generateThumbnail(file) {
    // Ensure the file is valid
    if (!(file instanceof File)) {
        console.error("Invalid file object:", file);
        return;
    }

    // Create a container for the thumbnail
    const div = document.createElement("div");
    div.classList.add("file");
    div.innerHTML = `<div><canvas id="thumb-${file.name}"></canvas></div><p>${file.name}</p>`;
    thumbnailDiv.appendChild(div); // Append to the designated container

    // Select the canvas and get its context
    const canvas = div.querySelector("canvas");
    const ctx = canvas.getContext("2d");

    const img = new Image();
    const reader = new FileReader();

    reader.onload = function (e) {
        img.onload = function () {
            // Draw the original image on a temporary canvas to access pixel data
            const tempCanvas = document.createElement("canvas");
            const tempCtx = tempCanvas.getContext("2d");
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            tempCtx.drawImage(img, 0, 0);

            // Extract the imageData from the temporary canvas
            const imageData = tempCtx.getImageData(0, 0, img.width, img.height);

            // Crop the image using the pixel object-based cropping function
            const { canvas: croppedCanvas } = cropTransparentEdges(imageData);

            // Copy cropped canvas contents to the thumbnail canvas
            canvas.width = croppedCanvas.width;
            canvas.height = croppedCanvas.height;
            ctx.drawImage(croppedCanvas, 0, 0);

            // Display the uncropped image in the larger view
            displayOriginalImage(file);
        };
        img.src = e.target.result; // Load the file into the image element
    };
    reader.readAsDataURL(file); // Read the file as a Data URL

    // Add selection toggle logic for the thumbnail
    div.addEventListener("click", () => {
        div.classList.toggle("selected");
        console.log(`${file.name} ${div.classList.contains("selected") ? "selected" : "deselected"}`);
    });
}


// Validate the dimensions of an image file
function validateDimensions(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                // Check specific width and height requirements
                if (img.width === 140 && img.height === 300) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            };
            img.onerror = () => reject(new Error("Invalid image file."));
            img.src = e.target.result; // Set image source
        };
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsDataURL(file); // Read the file as a data URL
    });
}

// Save the current fileList to localStorage in a simplified format
function saveFileListToLocalStorage() {
    const filePromises = fileList.map(file => {
        return new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = function (e) {
                resolve({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    data: e.target.result, // Base64 data of the file
                });
            };
            reader.readAsDataURL(file);
        });
    });

    Promise.all(filePromises).then(simplifiedList => {
        localStorage.setItem("fileList", JSON.stringify(simplifiedList));
        console.log("File list saved to localStorage:", simplifiedList);
    });
}

function getPixelObjects(imageData) {
    const { data, width, height } = imageData;
    const pixels = [];
    
    for (let i = 0; i < data.length; i += 4) {
        pixels.push({
            r: data[i],
            g: data[i + 1],
            b: data[i + 2],
            a: data[i + 3],
            x: (i / 4) % width,
            y: Math.floor((i / 4) / width),
        });
    }

    return { pixels, width, height };
}

function cropTransparentEdges(imageData) {
    const { pixels, width, height } = getPixelObjects(imageData);

    let top = height, bottom = 0, left = width, right = 0;

    pixels.forEach(pixel => {
        if (pixel.a > 0) {
            top = Math.min(top, pixel.y);
            bottom = Math.max(bottom, pixel.y);
            left = Math.min(left, pixel.x);
            right = Math.max(right, pixel.x);
        }
    });

    // Calculate new dimensions
    const newWidth = right - left + 1;
    const newHeight = bottom - top + 1;

    // Create a new ImageData object
    const newCanvas = document.createElement("canvas");
    newCanvas.width = newWidth;
    newCanvas.height = newHeight;
    const newCtx = newCanvas.getContext("2d");

    // Create a new ImageData object to store the cropped pixels
    const newImageData = newCtx.createImageData(newWidth, newHeight);

    // Populate the new ImageData with filtered pixels
    const croppedPixels = pixels.filter(pixel =>
        pixel.x >= left && pixel.x <= right && pixel.y >= top && pixel.y <= bottom
    );

    croppedPixels.forEach((pixel, i) => {
        const index = i * 4; // Each pixel has 4 values (r, g, b, a)
        newImageData.data[index] = pixel.r;
        newImageData.data[index + 1] = pixel.g;
        newImageData.data[index + 2] = pixel.b;
        newImageData.data[index + 3] = pixel.a;
    });

    // Put the new ImageData on the canvas
    newCtx.putImageData(newImageData, 0, 0);

    return { canvas: newCanvas, croppedWidth: newWidth, croppedHeight: newHeight };
}

function displayOriginalImage(file) {

    const largeDisplayDiv = document.querySelector("#large-display");

    // Create a container for the image
    const div = document.createElement("div");
    div.classList.add("large-file");
    div.innerHTML = `<p>${file.name}</p>`;
    largeDisplayDiv.appendChild(div);

    const iconsDiv = document.createElement("div");
    const itemDiv = document.createElement("div");
    const templateDspDiv = document.createElement("div");
    const coverAreaDspDiv = document.createElement("div");
    const canvas = document.createElement("canvas");

    // Generate ID for the canvas
    const canvasId = `large-${CSS.escape(file.name)}`;
    console.log("Generated large canvas ID:", canvasId);

    canvas.id = canvasId;
    templateDspDiv.className = "template-display";
    coverAreaDspDiv.className = "cover-display";
    iconsDiv.className = "icons-display";
    itemDiv.className = "item-display";

    const ctx = canvas.getContext("2d");
    div.appendChild(itemDiv);
    div.appendChild(iconsDiv);
    itemDiv.appendChild(templateDspDiv);
    itemDiv.appendChild(coverAreaDspDiv);
    itemDiv.appendChild(canvas);

    canvas.dataset.fileName = file.name;

    const img = new Image();
    const reader = new FileReader();

    reader.onload = function (e) {
        img.onload = function () {
            // Set the canvas dimensions to the original image dimensions
            canvas.width = img.width;
            canvas.height = img.height;

            checkCovereage(img, file.name, iconsDiv);
            
            // Save the original image source
            canvas.dataset.originalSrc = img.src;

            // Draw the full uncropped image onto the canvas
            ctx.drawImage(img, 0, 0);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

document.querySelector("#delete-all-btn").addEventListener("click", (e) => {    
    if (fileList.length > 0) {
        if (confirm("Are you sure you want to remove all files?")) {
            fileList.forEach(file => {
                const fileName = file.name;
                escapedFileName = CSS.escape(fileName);

                //console.log("Attempting to locate thumbnail with ID:", `#thumb-${fileName}`, document.querySelector(`#thumb-${escapedFileName}`));
                canvasThumbnail = document.querySelector(`#thumb-${escapedFileName}`);
                thumbnailParent = canvasThumbnail.closest(".file");
                thumbnailParent.remove();

                //console.log("Attempting to locate items with ID:", `#large-${fileName}`, document.querySelector(`#large-${escapedFileName}`));
                const largeCanvas = Array.from(document.querySelectorAll("#large-display canvas")).find((canvas) => canvas.dataset.fileName === fileName)
                largeParent = largeCanvas.closest(".large-file");
                largeParent.remove();

                // Update the fileList
                fileList = fileList.filter((file) => file.name !== fileName);

            });
            saveFileListToLocalStorage();
        }; 
    } else {
        alert("Files are already empty");
        return;
    }  
});

function trashFiles() {
    const selectedThumbnails = document.querySelectorAll(".file.selected");

    if (!selectedThumbnails.length) {
        alert("No files selected for deletion.");
        return;
    }

    if (confirm("Are you sure you want to delete the selected files?")) {
        selectedThumbnails.forEach((thumbnail) => {
            const fileCanvas = thumbnail.querySelector("canvas");
            if (!fileCanvas) {
                console.error("Thumbnail canvas not found.");
                return;
            }

            const fileName = fileCanvas.id.replace("thumb-", "");
            const escapedFileName = CSS.escape(fileName);

            console.log("Attempting to locate large canvas with ID:", `#large-${escapedFileName}`);

            // Locate the large image display
            const largeCanvas = Array.from(document.querySelectorAll("#large-display canvas")).find((canvas) => canvas.dataset.fileName === fileName);
            if (largeCanvas) {
                const largeImageContainer = largeCanvas.closest(".large-file");
                if (largeImageContainer) {
                    largeImageContainer.remove();
                    console.log(`Removed large canvas for '${fileName}'.`);
                } else {
                    console.warn(`Container for large canvas '${escapedFileName}' not found.`);
                }
            } else {
                console.warn(`Large canvas for '${escapedFileName}' not found.`);
            }

            // Remove the thumbnail
            thumbnail.remove();

            // Update the fileList
            fileList = fileList.filter((file) => file.name !== fileName);
        });

        saveFileListToLocalStorage();
        console.log("Updated fileList:", fileList);
    }
}

//listens for zooming
window.addEventListener("resize", (e) => {
    getBrowserZoomLevel();
    
    document.documentElement.style.setProperty('--bg-size', 28 * 100/getBrowserZoomLevel()+1+("px"));
});

//returns zoom
function getBrowserZoomLevel(){
    const zoomLevel = Math.round(window.devicePixelRatio * 100);
    return zoomLevel;
}

document.querySelector("#toggle-cover-chbx").addEventListener("change", function (e){
    if (this.checked) {
        document.documentElement.style.setProperty('--bg-cover-toggle', `url("Images/Cover_Area.png")`);
        console.log("Checkbox is checked..");
    } else {
        document.documentElement.style.setProperty('--bg-cover-toggle', "none");
        console.log("Checkbox is not checked..");
    } 
});


function changeTemplate(){
    console.log("change");
    let template;
    switch (document.querySelector("#select-template").value){
        case "mannequin": template = "Images/mannequin.png"; break;
        case "skin-1": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAANZa9n8ABQAAACsFAAQAACcTAQACAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAAABA.Ye&l=t"; break;
        case "skin-2": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAAIL_Of8ABQAAACsFAAQAACcTAQECAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAABvj_1f&l=t"; break;
        case "skin-3": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAAN62P1sABQAAACsFAAQAACcTAQICAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAADcG9Cc&l=t"; break;
        case "skin-4": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAAIoT8NsABQAAACsFAAQAACcTAQMCAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAACyl8vd&l=t"; break;
        case "skin-5": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAACy91T8ABQAAACsFAAQAACcTAQQCAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAABgQo1b&l=t"; break;
        case "skin-6": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAAHgYGr8ABQAAACsFAAQAACcTAQUCAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAAAOzpYa&l=t"; break;
        case "skin-7": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAACRRHBsABQAAACsFAAQAACcTAQYCAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAAC9WrvZ&l=t"; break;
        case "skin-8": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAAHD005sABQAAACsFAAQAACcTAQcCAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAADT1qCY&l=t"; break;
        case "skin-9": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAAPjltr4ABQAAACsFAAQAACcTAQgCAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAADDgTCU&l=t"; break;
        case "skin-10": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAAKxAeT4ABQAAACsFAAQAACcTAQkCAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAACtDSvV&l=t"; break;
        case "skin-11": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAAM0T9c0ABQAAACsFAAQADFIrAQACAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAAD3QYpZ&l=t"; break;
        case "skin-12": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAAP0GgdQABQAAACsFAAQADFIsAQACAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAAAFJ4Pk&l=t"; break;
        case "skin-13": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAAD3TQiQABQAAACsFAAQADFItAQACAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAABmIFrA&l=t"; break;
        case "skin-14": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAANEZWtQABQAAACsFAAQADFIuAQACAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAADDKDGs&l=t"; break;
        case "skin-15": template = "https://gosupermodel.com/dollsnapshot.png?k=AAAAABHMmSQABQAAACsFAAQADFIvAQACAAAB1MAAAg4AAAAnEQEAAAAAACcRAgAAAAAAAACgL.iI&l=t"; break;
    }
    document.documentElement.style.setProperty('--bg-template-toggle', `url("${template}")`);
};

document.querySelector("#select-template").addEventListener("change", function(e){
    const chbx = document.querySelector("#toggle-template-chbx");
  
    changeTemplate();
    chbx.checked = true;

});

document.querySelector("#toggle-template-chbx").addEventListener("change", function (e){
    if (this.checked) {
        changeTemplate();
    } else {
        document.documentElement.style.setProperty('--bg-template-toggle', "none");
    } 
});

document.querySelector("#bg-color-picker").addEventListener("input", function changeBgColor(e){
    const chbx = document.querySelector("#toggle-bg-color");
    document.documentElement.style.setProperty('--bg-color-toggle', this.value);
    chbx.checked = true;
});

document.querySelector("#toggle-bg-color").addEventListener("change", function (e){

    const colorPicker = document.querySelector("#bg-color-picker");
    if (this.checked) {
        document.documentElement.style.setProperty('--bg-color-toggle', colorPicker.value);

    } else {
        document.documentElement.style.setProperty('--bg-color-toggle', (`url("Images/Transparent.png")`));
    } 
});


function isImageCoveringMask(alphaMask, image) {
    threshold = 229;

    // Create canvases to load the images
    const maskCanvas = document.createElement("canvas");
    const maskCtx = maskCanvas.getContext("2d");

    const uploadCanvas = document.createElement("canvas");
    const uploadCtx = uploadCanvas.getContext("2d");

    // Ensure both images are the same size
    const width = alphaMask.width;
    const height = alphaMask.height;
    maskCanvas.width = uploadCanvas.width = width;
    maskCanvas.height = uploadCanvas.height = height;

    // Draw the images onto their respective canvases
    maskCtx.drawImage(alphaMask, 0, 0, width, height);
    uploadCtx.drawImage(image, 0, 0, width, height);

    // Get the pixel data from both images
    const maskData = maskCtx.getImageData(0, 0, width, height).data;
    const uploadData = uploadCtx.getImageData(0, 0, width, height).data;

    // Iterate through each pixel
    for (let i = 0; i < maskData.length; i += 4) {
        const maskAlpha = maskData[i + 3]; // Alpha value of the mask pixel
        const uploadAlpha = uploadData[i + 3]; // Alpha value of the uploaded image pixel

        // If the mask pixel is above the threshold
        if (maskAlpha > threshold) {
            // Check if the uploaded image pixel also meets the threshold
            if (uploadAlpha <= threshold) {
                //console.warn(`Pixel at index ${i / 4} does not meet the threshold.`);
                return false; // The mask pixel is not covered
            }
        }
    }

    return true; // All relevant mask pixels are covered
}

function checkCovereage(image, name, div){
    const boobCvrgImg = new Image();
    const crotchCvrgImg = new Image();

    boobCvrgImg.src = "Images/Boob_Area.png";
    crotchCvrgImg.src = "Images/Crotch_Area.png";

    boobCvrgImg.onload = () => {
        crotchCvrgImg.onload = () => {

            const result = isImageCoveringMask(boobCvrgImg, image);
            //console.log("Is ", name, " covering the boobs?", result);
            const result1 = isImageCoveringMask(crotchCvrgImg, image);
            //console.log("Is ", name, "covering the crotch", result1);

            if (result) {
                const iconImg = document.createElement("img");
                iconImg.src = "Images/icon_covers_top.png"
                div.appendChild(iconImg);
            }
            if (result1) {
                const iconImg = document.createElement("img");
                iconImg.src = "Images/icon_covers_bottom.png"
                div.appendChild(iconImg);
            }
        };
    };
}

document.querySelector("#toggle-opaque-chbx").addEventListener("change", function (e){
    let isRedOverlayActive;

    isRedOverlayActive = !isRedOverlayActive;
    if (this.checked){
        isRedOverlayActive = true;
    } else {
        isRedOverlayActive = false;
    }

    const largeDisplay = document.querySelector("#large-display");
    const canvases = largeDisplay.querySelectorAll("canvas");

    canvases.forEach((canvas) => {
        const ctx = canvas.getContext("2d");
        if (canvas.parentElement.querySelector(".opaqueFilter") != null){
            if (isRedOverlayActive){
                canvas.parentElement.querySelector(".opaqueFilter").classList.remove("hidden");

            } else{
                canvas.parentElement.querySelector(".opaqueFilter").classList.add("hidden");
            }
        } else {
            applyRedOverlay(ctx, canvas);
        }
    });
});

function applyRedOverlay(ctx, canvas) {
    const newCanvas = document.createElement("canvas");
    newCanvas.className = "opaqueFilter";

    newCanvas.width = canvas.width;
    newCanvas.height = canvas.height;

    canvas.after(newCanvas);

    const ctx1 = newCanvas.getContext("2d");


    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // Modify the pixel data to make all non-transparent pixels red and fully opaque
    for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] > 0) { // If alpha > 0
            pixels[i] = 255; // Red channel
            pixels[i + 1] = 0; // Green channel
            pixels[i + 2] = 0; // Blue channel
            pixels[i + 3] = 255; // Fully opaque
        }
    }

    ctx1.putImageData(imageData, 0, 0);
}


function drawBoundingBox(ctx, canvas) {

    const newCanvas = document.createElement("canvas");
    newCanvas.className = "boundingBox";

    newCanvas.width = canvas.width+2;
    newCanvas.height = canvas.height+2;

    canvas.after(newCanvas);

    const ctx1 = newCanvas.getContext("2d");

    
    // Get image data from the canvas
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = imageData;

    let minX = width, maxX = 0, minY = height, maxY = 0;

    // Detect the non-transparent area
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4; // Each pixel has 4 components (RGBA)
            const alpha = data[index + 3]; // Alpha channel

            if (alpha > 0) { // Non-transparent pixel

                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
        }
    }

    // Ensure we detected a region
    if (minX <= maxX && minY <= maxY) {
        // Draw the bounding box
        ctx1.strokeStyle = "black";
        ctx1.lineWidth = 1;

        const boxWidth = maxX - minX + 2;
        const boxHeight = maxY - minY + 2;
        console.log(minX+0.5, minY+0.5, boxWidth, boxHeight);
        ctx1.strokeRect(minX+0.5, minY+0.5, boxWidth, boxHeight);
    } else {
        console.error("No content detected in the image.");
    }
}


document.querySelector("#toggle-boundingbx-chbx").addEventListener("change", function (e){
    let isBoundingActive;

    isBoundingActive = !isBoundingActive;
    if (this.checked){
        isBoundingActive = true;
    } else {
        isBoundingActive = false;
    }

    const largeDisplay = document.querySelector("#large-display");
    const canvases = largeDisplay.querySelectorAll("canvas");

    canvases.forEach((canvas) => {
        const ctx = canvas.getContext("2d");
        if (canvas.parentElement.querySelector(".boundingBox") != null){
            if (isBoundingActive){
                canvas.parentElement.querySelector(".boundingBox").classList.remove("hidden");

            } else{
                canvas.parentElement.querySelector(".boundingBox").classList.add("hidden");
            }
        } else {
            drawBoundingBox(ctx, canvas);
        }
    });
});
