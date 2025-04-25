class UserStampMixin:
    """
    Mixin to automatically handle created_by and updated_by fields.
    """
    def perform_create(self, serializer):
        """Add created_by and updated_by when creating an object."""
        serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user
        )

    def perform_update(self, serializer):
        """Update the updated_by when updating an object."""
        serializer.save(updated_by=self.request.user) 