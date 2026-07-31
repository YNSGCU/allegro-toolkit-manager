;; core_lib.il - Core library with dependencies

defun( coreInit(
  printf("Core initialized\n")
))

defun( coreCleanup(
  printf("Core cleaned up\n")
))

procedure( getVersion(
  "1.0.0"
))
