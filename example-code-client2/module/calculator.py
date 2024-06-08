def calculator():
    print("Basic Calculator")
    print("Select operation:")
    print("1. Addition")
    print("2. Subtraction")
    print("3. Multiplication")
    print("4. Division")

    choice = input("Enter choice (1/2/3/4): ")

    if choice in ['1', '2', '3', '4']:
        num1 = float(input("Enter first number: "))
        num2 = float(input("Enter second number: "))

        if choice == '1':
            print(f"{num1} + {num2} = {num1 + num2}")

        elif choice == '2':
            print(f"{num1} - {num2} = {num1 - num2}")

        elif choice == '3':
            print(f"{num1} * {num2} = {num1 * num2}")

        elif choice == '4':
            if num2 != 0:
                print(f"{num1} / {num2} = {num1 / num2}")
            else:
                print("Error! Division by zero.")

    else:
        print("Invalid Input")

calculator()
Snippet 2: Fibonacci Sequence Generator
This code snippet generates the Fibonacci sequence up to a specified number of terms.

python
Copy code
def fibonacci(n):
    sequence = []
    a, b = 0, 1
    while len(sequence) < n:
        sequence.append(a)
        a, b = b, a + b
    return sequence

n_terms = int(input("Enter the number of terms: "))
if n_terms <= 0:
    print("Please enter a positive integer.")
else:
    print("Fibonacci sequence:")
    print(fibonacci(n_terms))