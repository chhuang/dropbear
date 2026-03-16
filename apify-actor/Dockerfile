# Use Apify's Playwright image
FROM apify/actor-node-playwright:20

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=optional

# Copy source code
COPY . ./

# Build if needed
RUN npm run build --if-present

# Run the actor
CMD ["npm", "start"]
