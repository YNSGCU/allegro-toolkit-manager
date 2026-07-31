;; sample_utils.il - ATM Skill test fixture
;; Testing procedure/defun parsing

procedure(myAutoFanout(
  let((parent)
    axlClearSelSet()
    axlShell("fanout")
  )
))

procedure( highlightNet(
  let((netname)
    axlClearSelSet()
    axlHighlightNet(netname)
  )
))

defun( testFunc(
  printf("Hello from testFunc\n")
))

(defun legacyFunc
  (printf "Legacy style\n")
)

defunValue( myValueFunc(
  123
))

; comment line with procedure(shouldNotMatch(
; also ; defun(shouldNotMatch(

;; this is a comment
;; procedure(commentedOut(
