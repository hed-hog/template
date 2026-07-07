#!/bin/bash
# Build script for Admin Docker image

set -e

# Default values
TAG="hedhog-admin:latest"
NO_CACHE=false
PUSH=false
REGISTRY=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --tag)
            TAG="$2"
            shift 2
            ;;
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        --push)
            PUSH=true
            shift
            ;;
        --registry)
            REGISTRY="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --tag TAG         Image tag (default: hedhog-admin:latest)"
            echo "  --no-cache        Build without cache"
            echo "  --push            Push to registry after build"
            echo "  --registry URL    Registry URL for push"
            echo "  --help            Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "🐳 Building Admin Docker Image"
echo "================================"
echo ""

# Ensure we're in the monorepo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR"

echo "📁 Working directory: $ROOT_DIR"
echo "🏷️  Image tag: $TAG"
echo ""

# Build arguments
BUILD_ARGS=(
    "build"
    "-f" "apps/admin/Dockerfile"
    "-t" "$TAG"
)

if [ "$NO_CACHE" = true ]; then
    echo "⚠️  Building without cache"
    BUILD_ARGS+=("--no-cache")
fi

BUILD_ARGS+=(".")

echo "🔨 Building image..."
echo "Command: docker ${BUILD_ARGS[*]}"
echo ""

docker "${BUILD_ARGS[@]}"

echo ""
echo "✅ Build successful!"

# Push to registry if requested
if [ "$PUSH" = true ]; then
    if [ -n "$REGISTRY" ]; then
        FULL_TAG="$REGISTRY/$TAG"
        echo ""
        echo "🏷️  Tagging image as: $FULL_TAG"
        docker tag "$TAG" "$FULL_TAG"
        
        echo "📤 Pushing to registry..."
        docker push "$FULL_TAG"
        
        echo "✅ Push successful!"
    else
        echo ""
        echo "⚠️  Registry not specified. Use --registry parameter"
    fi
fi

echo ""
echo "📊 Image information:"
docker images "$TAG"

echo ""
echo "🚀 To run the container:"
echo "   docker run -d -p 3200:3200 --name hedhog-admin $TAG"

echo ""
echo "📝 For more options, see:"
echo "   apps/admin/DOCKERFILE.md"
echo "   apps/admin/DEPLOY.md"
